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
    
    setTimeout(function() { self.emit('ready'); }, 200);
    
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
                return function(data) {
                    var request = { read: id, epid: msg.read.epid, data: data };
                    self.addon.request("mistnode", request);
                }; 
            })(msg.read.id));
        } else {
            console.log("There is no invoke function registered for", msg.read.epid );
        }
    });
    
    this.addon.on('write', function(msg) {
        if(typeof self.writeCb[msg.write.epid] === 'function') {
            self.writeCb[msg.write.epid](msg.write.args, msg.peer, function () {
                console.log('write should send ack');
            });
        } else {
            console.log("There is no write function registered for", msg.write.epid );
        }
    });

    this.addon.on('invoke', function(msg) {
        if(typeof self.invokeCb[msg.invoke.epid] === 'function') {
            self.invokeCb[msg.invoke.epid](msg.invoke.args, msg.peer, (function (id) {
                return function(data) {
                    var request = { invoke: id, epid: msg.invoke.epid, data: data };
                    self.addon.request("mistnode", request);
                }; 
            })(msg.invoke.id));
        } else {
            console.log("There is no invoke function registered for", msg.invoke.epid );
        }
    });
}

inherits(MistNodeInner, EventEmitter);

MistNodeInner.prototype.create = function(model, cb) {
    this.addon.request("mistnode", { model: model });
};

MistNodeInner.prototype.endpointAdd = function(epid, endpoint) {
    var path = epid.split('.');
    
    var parent;
    
    if (path.length === 1) {
        parent = null;
    } else if (path.length > 1) {
        parent = path.slice(0, path.length-1).join('.');
    } else {
        return console.log('endpoint could not be added, due to invalid arguments');
    }
    
    epid = path.slice(-1)[0];
    
    endpoint.parent = parent;
    endpoint.epid = epid;
    
    this.addon.request("mistnode", { endpointAdd: true, ep: endpoint });
};

MistNodeInner.prototype.endpointRemove = function(epid) {
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

module.exports = {
    MistNodeInner: MistNodeInner };
