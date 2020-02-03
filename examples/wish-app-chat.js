/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
//var WishApp = require('mist-api').WishApp;
var WishApp = require('../index.js').WishApp;

var white = '\u001b[37m';
var yellow = '\u001b[33m';
var green = '\u001b[34m';
var blue = '\u001b[32m';
var reset = '\u001b[39m';

var chat = new WishApp({ name: process.env.SID || 'Chat', protocols: ['chat'] });

chat.onlineCb = function(peer) {
    chat.request('identity.get', [peer.ruid], function(err, user) {
        console.log(reset+'online:'+blue, user.alias);
    });
};

chat.offlineCb = function(peer) {
    chat.request('identity.get', [peer.ruid], function(err, user) {
        console.log(reset+'offline:'+blue, user.alias);
    });
};
    
chat.frameCb = function(peer, data) {
    chat.request('identity.get', [peer.ruid], function(err, user) {
        console.log(yellow + user.alias + ': ' +white+ data.toString());
    });
};

process.stdin.on('data', function(data) {
    chat.broadcast(new Buffer(data.toString().trim()));
});
