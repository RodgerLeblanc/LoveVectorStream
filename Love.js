"use strict";

var useConfig = true; // set to false to pass config in debug

var request = require('request');
var VectorWatch = require('vectorwatch-sdk');

var vectorWatch = new VectorWatch();

var logger = vectorWatch.logger;

var cloudantUrl = 'your_own_cloudant_database_url' + process.env.STREAM_UUID;
var cloudantDbDocument = {};

if (!cloudantDbDocument.messages) {
    try {
        getCloudantDbDocument();
    } catch (err) {
        logger.error('Error with Cloudant: ' + err.message);
    }
}

vectorWatch.on('config', function(event, response) {
    logger.info('on config');
    

    if (useConfig) {
        var message = response.createAutocomplete('Message');
        message.setHint('Enter your love message to share to the world. Make it short and sweet! (ie: Love touching your wrist)');
        message.setAsYouType(1);
        
        addOptionForOldMessage(event, message);
        
        // Add love message samples
        /*
        message.addOption('I love you');
        message.addOption('You are special to me');
        message.addOption('Your wrist is wonderful');
        */

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

function addOptionForOldMessage(event, message) {
    var oldMessage;
    try {
        var userKey = event.req.body.userKey;
        if (cloudantDbDocument.messages) {
            var keys = Object.keys(cloudantDbDocument.messages);
            for (var i in keys) {
                var key = keys[i];
                if (cloudantDbDocument.messages[key].userKey === userKey) {
                    oldMessage = cloudantDbDocument.messages[key].message;
                    break;
                }
            }
        }
    } catch(err) {
        logger.error('Error getting channelLabel: ' + JSON.stringify(event) + '\n' + err.message);
    }
    
    if (oldMessage) {
        message.addOption(oldMessage);
    }
}

vectorWatch.on('options', function(event, response) {
});

vectorWatch.on('subscribe', function(event, response) {
    logger.info('on subscribe: ' + event.channelLabel);

    if (!useConfig) {
        // For debug only
        var userSettings = JSON.parse('{"Message":{"name":"Love you"},"Update":{"name":"1"}}');
        event.userSettings.settings = userSettings;
    }

    try { 
        // Update Cloudant DB if new love message is different than the one in Cloudant DB for this user
        var key = event.channelLabel;
        if (!cloudantDbDocument.messages[key] || !cloudantDbDocument.messages[key].message) {
            cloudantDbDocument.messages[key] = JSON.parse('{"message":"","lastUpdateTime":0}');
        }
        cloudantDbDocument.messages[key]["userKey"] = event.req.body.userKey;

        var banned = cloudantDbDocument.banned;
        if (banned.some(function(e, i, a) { return e === key; })) {
            response.setValue('-Banned-');
        	response.send();
	        return;
        }
        
        var messageFromUserSettings = event.userSettings.settings.Message.name;
        var messageFromCloudant = cloudantDbDocument.messages[key].message;
        if (messageFromUserSettings !== messageFromCloudant) {
            cloudantDbDocument.messages[key].message = messageFromUserSettings;
            updateCloudantDb().catch(function(e) {
                try {
                    // Retry once again, but update document first to get latest _rev
                    getCloudantDbDocument()
                        .then(function(body) {
                            cloudantDbDocument.messages[key].message = messageFromUserSettings;
                            updateCloudantDb().catch(function(e) {
                                logger.error('Second error trying to update Cloudant DB: ' + e);
                            })
                        });
                } catch(err) {
                    logger.error('Error getting Cloudant DB document: ' + err.message);
                }
            });
        }
    } catch(err) {
        logger.error('Error updating cloudant: ' + err.message);
    }

    var streamText = getRandomLoveMessage();
    
    cloudantDbDocument.messages[key]["lastUpdateTime"] = Date.now;
    
    response.setValue(streamText);
	response.send();
});

vectorWatch.on('unsubscribe', function(event, response) {
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
    
    var forceUpdate = true;
    try {
        getCloudantDbDocument()
            .then(updateStreamForEveryRecord(records, forceUpdate));
    } catch(err) {
        logger.error('Error getting Cloudant DB');
        updateStreamForEveryRecord(records, forceUpdate);
    }
    
    response.setContentType('text/plain');
    response.statusCode = 200;
    response.setContent('Ok');
    response.send();
});

function updateStreamForEveryRecord(records, forceUpdate) {
    var streamText = getRandomLoveMessage();
    records.forEach(function(record) {
        try {
            logger.info('record: ' + JSON.stringify(record));
            var key = record.channelLabel;
            if (!cloudantDbDocument.messages[key] || cloudantDbDocument.messages[key].lastUpdateTime === undefined) {
                var messageObject = {};
                messageObject['message'] = record.userSettings.Message.name;
                messageObject['lastUpdateTime'] = 0;
                messageObject['userKey'] = key;
                cloudantDbDocument.messages[key] = messageObject;
            }
            
            var banned = cloudantDbDocument.banned;
            if (banned.some(function(e, i, a) { return e === key; })) {
                record.pushUpdate('-Banned-');
                return;
            }

            var userSettings = record.userSettings;
            var updateTimeInMs = parseInt(userSettings.Update.name) * 60 * 1000 - (10 * 1000); // 10 secs margin
            var lastUpdateTime = cloudantDbDocument.messages[key].lastUpdateTime || 0;
            var difference = Date.now - lastUpdateTime;
            if ((difference > updateTimeInMs) || forceUpdate) {
                record.pushUpdate(streamText);
                cloudantDbDocument.messages[key].lastUpdateTime = Date.now;
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
        var keys = Object.keys(cloudantDbDocument.messages);
        var randomIndex = Math.floor(Math.random() * keys.length);
        var key = keys[randomIndex];
        returnedMessage = cloudantDbDocument.messages[key].message.replace(/love|heart|aime|coeur/gi, String.fromCharCode(0xe033));
    } catch(err) {
        logger.error('Error while getting random love message');
    }
    
    return returnedMessage || "You're lovely";
}

function getCloudantDbDocument() {
    return new Promise(function(resolve, reject) {
        request(cloudantUrl, function(error, httpResponse, body) {
            if (error) {
                reject('Error calling ' + cloudantUrl + ': ' + error.message);
                return;
            }
            
            if (httpResponse && httpResponse.statusCode !== 200) {
                reject('Status code error for ' + cloudantUrl + ': ' + httpResponse.statusCode);
                return;
            }
            
            try {
                logger.info('response: ' + body);
                cloudantDbDocument = JSON.parse(body);
                logger.info('cloudantDbDocument: ' + JSON.stringify(cloudantDbDocument));
            } catch(err) {
                logger.info('Error parsing JSON response');
            }
        });
    });
}

function updateCloudantDb() {
    return new Promise(function(resolve, reject) {
        request.put({
            url: cloudantUrl,
            body: JSON.stringify(cloudantDbDocument)
        }, function(error, httpResponse, body) {
            if (error) {
                reject('Error calling ' + cloudantUrl + ': ' + error.message);
                return;
            }
            
            if (httpResponse && httpResponse.statusCode !== 200) {
                reject('Status code error for ' + cloudantUrl + ': ' + httpResponse.statusCode);
                return;
            }
            
            try {
                logger.info('response: ' + body);
                body = JSON.parse(body);
                cloudantDbDocument._rev = body.rev;
                logger.info('cloudantDbDocument: ' + JSON.stringify(cloudantDbDocument));
            } catch(err) {
                logger.info('Error parsing JSON response');
            }
        });
    });
}
