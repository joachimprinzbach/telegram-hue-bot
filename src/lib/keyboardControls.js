'use strict';

import hugh from 'hugh';
import MessageBuilder from './messageBuilder';
import state from './state';
import logger from './logger';
import validCommands from './validCommands';
import _ from 'lodash';

class KeyboardControls {
  constructor(bot, user, chatId, origMsgId, config, cache, hueCommands) {
    this.config = config;
    this.hueCommands = hueCommands;
    this.hueApi = new hugh.HueApi(config.hue.host, config.hue.user);
    this.bot = bot;
    this.user = user;
    this.cache = cache;
    this.chatId = chatId;
    this.origMsgId = origMsgId;
    this.username = this.user.username || (this.user.first_name + (' ' + this.user.last_name || ''));
  }

  clearCache() {
    logger.info(`user: ${this.username}, message: clearing keyboard controls cache`);

    var cacheItems = [
      'resource', 'light', 'group',
      'scene', 'id', 'command', 'state'
    ];

    return _(cacheItems).forEach((item) => {
      this.cache.del(item + this.user.id);
    });
  }

  sendResources() {
    const keyboard = [];
    keyboard.push(validCommands.list);
    this.cache.set(`state${this.user.id}`, state.RESOURCE);
    return this.sendMessage('Please choose a light, group or scene', keyboard);
  };

  // TODO: ERROR HANDLING
  sendList(resource) {
    switch (resource) {
      case 'lights': {
        return this.hueApi.lights()
          .then((results) => {
            const keyboard = MessageBuilder.lightsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.LIGHT);
            this.cache.set(`resource${this.user.id}`, state.LIGHT);
            return this.sendMessage('Please choose a light', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sendMessage('Something went wrong!');
          });
      }

      case 'groups': {
        return this.hueApi.groups()
          .then((results) => {
            const keyboard = MessageBuilder.groupsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.GROUP);
            this.cache.set(`resource${this.user.id}`, state.GROUP);
            return this.sendMessage('Please choose a group', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sendMessage('Something went wrong!');
          });
      }

      case 'scenes': {
        return this.hueApi.scenes()
          .then((results) => {
            const keyboard = MessageBuilder.scenesKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.SCENE);
            return this.sendMessage('Please choose a scene', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sendMessage('Something went wrong!');
          });
      }

      default: {
        this.clearCache();
        throw new Error(`State: ${state} message: ${resource} - Shouldn't end up here`);
      }
    }
  }

  sendLightCommands(lightId) {
    return this.hueApi.lightStatus(lightId)
      .then((results) => {
        const lightStatus = MessageBuilder.light(results);
        const textMessage = `${lightStatus}\n\nPlease choose a command`;
        const keyboard = MessageBuilder.lightCommandsKeyboard();
        this.cache.set(`state${this.user.id}`, state.COMMAND);
        this.cache.set(`resourceId${this.user.id}`, lightId);
        return this.sendMessage(textMessage, keyboard);
      })
      .catch((error) => {
        this.clearCache();
        logger.error(error);
        return this.sendMessage('Something went wrong!');
      });
  }

  sendGroupCommands(groupId) {
    return this.hueApi.groupStatus(groupId)
      .then((results) => {
        const groupStatus = MessageBuilder.group(results);
        const textMessage = `${groupStatus}\n\nPlease choose a command`;
        const keyboard = MessageBuilder.groupCommandsKeyboard();
        this.cache.set(`state${this.user.id}`, state.COMMAND);
        this.cache.set(`resourceId${this.user.id}`, groupId);
        return this.sendMessage(textMessage, keyboard);
      })
      .catch((error) => {
        this.clearCache();
        logger.error(error);
        return this.sendMessage('Something went wrong!');
      });
  }

  setLightState(resourceId, command) {
    this.hueCommands.lights(resourceId, command)
      .then((msg) => {
        this.clearCache();
        this.sendMessage(msg);
        return this.sendResources();
      })
      .catch((error) => {
        this.clearCache();
        logger.error(error);
        return this.sendMessage('Something went wrong!');
      })
  }

  setGroupState(resourceId, command) {
    this.hueCommands.groups(resourceId, command)
      .then((msg) => {
        this.clearCache();
        this.sendMessage(msg);
        return this.sendResources();
      })
      .catch((error) => {
        this.clearCache();
        logger.error(error);
        return this.sendMessage('Something went wrong!');
      })
  }

  sendMessage(message, keyboard) {
    keyboard = keyboard || null;

    var options;
    if (message instanceof Error) {
      logger.warn('user: %s message: %s', this.username, message.message);

      message = message.message;
      options = {
        parse_mode: 'Markdown',
        reply_to_message_id: this.origMsgId,
        disable_notification: true,
        reply_markup: {
          hide_keyboard: true,
          selective: true
        }
      };
    } else {
      options = {
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
        reply_to_message_id: this.origMsgId,
        selective: true,
        disable_notification: true,
        reply_markup: JSON.stringify({
          keyboard: keyboard,
          one_time_keyboard: true,
          resize_keyboard: true,
          selective: true
        })
      };
    }

    return this.bot.sendMessage(this.chatId, message, options);
  }

}

export default KeyboardControls;
