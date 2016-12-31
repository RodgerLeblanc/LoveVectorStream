"use strict";

var useConfig = true;

var request = require('request');
var StorageProvider = require('vectorwatch-storageprovider');
var VectorWatch = require('vectorwatch-sdk');

var vectorWatch = new VectorWatch();

var storageProvider = new StorageProvider();
vectorWatch.setStorageProvider(storageProvider);

var logger = vectorWatch.logger;

vectorWatch.on('config', function(event, response) {
    // your stream was just dragged onto a watch face
    logger.info('on config');
    
    if (useConfig) {
        var message = response.createAutocomplete('Message');
        message.setHint('Enter your love message to share to the world. Make it short and sweet! (ie: Love touching your wrist)');
        message.setAsYouType(1);
        
        var update = response.createGridList('Update');
        update.setHint('How many minutes before updating your stream with a new love message?');
        update.addOption('1');
        update.addOption('5');
        update.addOption('15');
        update.addOption('60');
        update.addOption('120');
    }

    response.send();
});

vectorWatch.on('options', function(event, response) {
    // dynamic options for a specific setting name was requested
    logger.info('on options');
    
    return response;
});

vectorWatch.on('subscribe', function(event, response) {
    // your stream was added to a watch face
    logger.info('on subscribe: ' + event.channelLabel);
    
    if (!useConfig) {
        // Used for debug only
        var userSettings = JSON.parse('{"userSettings":{"Message":{"name":"Love you"},"Update":{"name":"1"}}}');
        var userSettingsTable = storageProvider.userSettingsTable;
        userSettingsTable[event.channelLabel] = userSettings;
    }

    var streamText = getRandomLoveMessage();
    
    response.setValue(streamText);
	response.send();
});

vectorWatch.on('unsubscribe', function(event, response) {
    // your stream was removed from a watch face
    logger.info('on unsubscribe: ' + event.channelLabel);
    response.send();
});

vectorWatch.on('schedule', function(records) {
    logger.info('on schedule');
    if (records.length <= 0) { return; }

    var forceUpdate = false;
    updateStreamForEveryRecord(records, forceUpdate);
});

vectorWatch.on('webhook', function(event, response, records) {
    logger.info('on webhook');
    
    var loveMessages = [];
    var userSettingsTable = storageProvider.userSettingsTable;
    Object.keys(userSettingsTable).forEach(function(key) {
        var userSettings = userSettingsTable[key].userSettings;
        loveMessages.push(userSettings.Message.name);
    });

    logger.info('loveMessages: ' + JSON.stringify(loveMessages));
    
    var forceUpdate = true;
    updateStreamForEveryRecord(records, forceUpdate);
    
    response.setContentType('text/plain');
    response.statusCode = 200;
    response.setContent('Ok');
    response.send();
});

function updateStreamForEveryRecord(records, forceUpdate) {
    var streamText = getRandomLoveMessage();
    logger.info('streamText: ' + streamText);
    records.forEach(function(record) {
        try {
            var userSettings = storageProvider.userSettingsTable[record.channelLabel].userSettings;
            var updateTimeInMs = parseInt(userSettings.Update.name) * 60 * 1000 - (10 * 1000); // 10 secs margin
            var lastUpdateTime = userSettings.LastUpdateTime || 0;
            var difference = Date.now - lastUpdateTime;
            if ((difference > updateTimeInMs) || forceUpdate) {
                record.pushUpdate(streamText);
                userSettings.LastUpdateTime = Date.now;
            }
        } catch(err) {
            logger.error('Error while updating record ' + record.channelLabel + ': ' + record.userSettings);
            logger.error('Error message: ' + err.message);
        }
    });
}

function getRandomLoveMessage() {
    var returnedMessage;
    try {
        var loveMessages = [];
        var userSettingsTable = storageProvider.userSettingsTable;
        Object.keys(userSettingsTable).forEach(function(key) {
            var userSettings = userSettingsTable[key].userSettings;
            loveMessages.push(userSettings.Message.name);
        });

        var index = Math.floor(Math.random() * loveMessages.length);
        returnedMessage = loveMessages[index];
    } catch(err) {
        logger.error('Error while getting random love message');
    }
    
    return returnedMessage || "You're lovely";
}
