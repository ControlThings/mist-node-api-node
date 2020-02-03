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
var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

function WishAppInner(addon) {
    var self = this;
    this.peers = [];
    this.requests = {};
    this.addon = addon;
    
    addon.on('ready', function(ready) {
        self.emit('ready', ready);
        if (typeof self.readyCb === 'function') { self.readyCb(ready); }
    });
    
    addon.on('online', function(peer) {
        if (typeof self.onlineCb === 'function') { self.onlineCb(peer); }
        self.peers.push(peer);
    });
    
    addon.on('offline', function(peer) {
        if (typeof self.offlineCb === 'function') { self.offlineCb(peer); }
    });
    
    addon.on('frame', function(peer, data) {
        if (typeof self.frameCb === 'function') { self.frameCb(peer, data); }
    });

    addon.on('wish', function(msg) {
        var id = msg.ack || msg.sig || msg.end || msg.err;

        if(typeof self.requests[id] === 'function') {
            self.requests[id](msg);

            if(!msg.sig) {
                delete self.requests[id];
            }
        } else {
            console.log('Request not found for response:', id, self, self.requests);
        }
    });
}

inherits(WishAppInner, EventEmitter);

WishAppInner.prototype.send = function(peer, message, cb) {
    this.request('services.send', [peer, message], cb || function() {});
};

WishAppInner.prototype.broadcast = function(message) {
    for(var i in this.peers) {
        this.request('services.send', [this.peers[i], message], function() {});
    }
};

WishAppInner.prototype.request = function(op, args, cb) {
    if (typeof cb !== 'function') { console.log("not function:", new Error().stack); }
    return this.requestBare(op, args, function(res) {
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

WishAppInner.prototype.requestBare = function(op, args, cb) {
    var id = ++this.addon.sharedRequestId;
    var request = { op: op, args: typeof args === 'undefined' ? [] : args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.addon.request("wish", request);

    return id;
};

WishAppInner.prototype.cancel = function(id) {
    this.addon.request("wish", { cancel: id });
};

WishAppInner.prototype.shutdown = function() {
    this.addon.shutdown();
};

module.exports = {
    WishAppInner: WishAppInner };
