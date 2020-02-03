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

function MistNodeInner(addon) {
    var self = this;
    this.peers = [];
    this.requests = {};
    this.readCb = {};
    this.writeCb = {};
    this.invokeCb = {};
    
    this.addon = addon;
    
    addon.on('ready', function(ready, sid) {
        self.emit('ready', ready, sid);
        if (typeof self.readyCb === 'function') { self.readyCb(ready); }
    });
    
    addon.on('online', function(peer) {
        self.emit('online', peer);
        if (typeof self.onlineCb === 'function') { self.onlineCb(peer); }
        self.peers.push(peer);
    });
    
    addon.on('offline', function(peer) {
        self.emit('offline', peer);
        if (typeof self.offlineCb === 'function') { self.offlineCb(peer); }
    });
    
    addon.on('frame', function(peer, data) {
        if (typeof self.frameCb === 'function') { self.frameCb(peer, data); }
    });

    addon.on('mistnode', function(msg) {
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
    
    this.addon.on('read', function(msg) {
        if(typeof self.readCb[msg.read.epid] === 'function') {
            self.readCb[msg.read.epid](msg.read.args, msg.peer, (function (id) {
                return function(err, data) {
                    if (err) { return self.addon.request("mistnode", { readError: id, epid: msg.read.epid, code: err.code, msg: err.msg }); }
                    
                    self.addon.request("mistnode", { read: id, epid: msg.read.epid, data: data });
                }; 
            })(msg.read.id));
        } else {
            console.log("There is no read function registered for", msg.read.epid );
        }
    });
    
    this.addon.on('write', function(msg) {
        if(typeof self.writeCb[msg.write.epid] === 'function') {
            self.writeCb[msg.write.epid](msg.write.args, msg.peer, function (err) {
                if (err) { return self.addon.request("mistnode", { writeError: msg.write.id, epid: msg.write.epid, code: err.code, msg: err.msg }); }

                self.addon.request("mistnode", { write: msg.write.id, epid: msg.write.epid });
            });
        } else {
            console.log("There is no write function registered for", msg.write.epid );
        }
    });

    this.addon.on('invoke', function(msg) {
        if(typeof self.invokeCb[msg.invoke.epid] === 'function') {
            self.invokeCb[msg.invoke.epid](msg.invoke.args, msg.peer, (function (id) {
                return function(err, data) {
                    if (err) { return self.addon.request("mistnode", { invokeError: id, epid: msg.invoke.epid, code: err.code, msg: err.msg }); }
                    
                    self.addon.request("mistnode", { invoke: id, epid: msg.invoke.epid, data: data });
                }; 
            })(msg.invoke.id));
        } else {
            console.log("There is no invoke function registered for", msg.invoke.epid );
        }
    });
}

inherits(MistNodeInner, EventEmitter);

MistNodeInner.prototype.create = function(model, cb) {
    var node = this;
    var visitor = function (modelFragment, parent) {
        for (var epid in modelFragment) {

            node.addEndpoint( parent + epid, {
                type: modelFragment[epid].type,
                read: modelFragment[epid].read,
                write: modelFragment[epid].write,
                invoke: modelFragment[epid].invoke
            });

            if (modelFragment[epid]['#']) {
                visitor(modelFragment[epid]['#'], parent + epid + '.');
            }
        }
    };
    
    visitor(model, "");
};

MistNodeInner.prototype.addEndpoint = function(fepid, endpoint) {
    var path = fepid.split('.');
    
    var parent;
    
    if (path.length === 1) {
        parent = null;
    } else if (path.length > 1) {
        parent = path.slice(0, path.length-1).join('.');
    } else {
        return console.log('endpoint could not be added, due to invalid arguments');
    }
    
    var epid = path.slice(-1)[0];
    
    endpoint.parent = parent;
    endpoint.epid = epid;
    
    if (typeof endpoint.read === 'function') { this.read(fepid, endpoint.read); endpoint.read = true; }
    if (typeof endpoint.write === 'function') { this.write(fepid, endpoint.write); endpoint.write = true; }
    if (typeof endpoint.invoke === 'function') { this.invoke(fepid, endpoint.invoke); endpoint.invoke = true; }
    if (endpoint.invoke) { endpoint.type = 'invoke'; }
    
    this.addon.request("mistnode", { endpointAdd: true, ep: endpoint });
};

MistNodeInner.prototype.removeEndpoint = function(epid) {
    this.addon.request("mistnode", { endpointRemove: epid });
};

// register read handler for epid
MistNodeInner.prototype.read = function(epid, cb) {
    this.readCb[epid] = cb;
};

// register write handler for epid
MistNodeInner.prototype.write = function(epid, cb) {
    this.writeCb[epid] = cb;
};

// register invoke handler for epid
MistNodeInner.prototype.invoke = function(epid, cb) {
    this.invokeCb[epid] = cb;
};

MistNodeInner.prototype.changed = function(epid) {
    var request = { changed: epid };
    
    this.addon.request("mistnode", request);
};

MistNodeInner.prototype.modelChanged = function() {
    var request = { modelChanged: true };
    
    this.addon.request("mistnode", request);
}

MistNodeInner.prototype.request = function(peer, op, args, cb) {
    return this.requestBare(peer, op, args, function(res) {
        //console.log('requestBare cb:', arguments);
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

MistNodeInner.prototype.requestBare = function(peer, op, args, cb) {
    var id = ++this.addon.sharedRequestId;
    var request = { peer: peer, op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;

    //console.log("Making request", request, this);
    
    this.addon.request("mistnode", request);
    
    return id;
};

MistNodeInner.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.addon.request("mistnode", request);
};

MistNodeInner.prototype.shutdown = function() {
    this.addon.shutdown();
};

module.exports = {
    MistNodeInner: MistNodeInner };
