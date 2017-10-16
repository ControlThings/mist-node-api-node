var MistApi = require('./addon.js');

var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

var bson = require('bson-buffer');
var BSON = new bson();

// request id shared by all
var sharedId = 0;

var instances = [];

function Addon(opts) {
    var self = this;
    
    this.api = new MistApi(function (event, data) {
        if (!event && !data) {
            // seems to be HandleOKCallback from nan
            // nan.h: AsyncWorker::WorkComplete(): callback->Call(0, NULL);
            return;
        }
        
        if (event === 'done') {
            // Streaming worker is done and has shut down
            return;
        }

        var msg = null;

        try {
            msg = BSON.deserialize(data);
        } catch(e) {
            return console.log('Warning! Non BSON message from plugin.', arguments, event, data);
        }

        if (event === 'online') {
            self.emit('online', msg.peer);
            msg.peer.online = true;
            if (typeof self.onlineCb === 'function') { self.onlineCb(msg.peer); }
            
            return;
        }

        if (event === 'offline') {
            self.emit('offline', msg.peer);
            if (typeof self.offlineCb === 'function') { self.offlineCb(msg.peer); }

            return;
        }

        if (event === 'frame') {
            self.emit('frame', msg.peer, msg.frame);
            
            var payload = BSON.deserialize(msg.frame);
            if (typeof self.frameCb === 'function') { self.frameCb(msg.peer, payload); }

            return;
        }

        if (event === 'read') {
            self.emit('read', msg);
            return;
        }

        if (event === 'write') {
            self.emit('write', msg);
            return;
        }

        if (event === 'invoke') {
            self.emit('invoke', msg);
            return;
        }

        if (event === 'wish') {
            self.emit('wish', msg);
            return;
        }

        if (event === 'mist') {
            self.emit('mist', msg);
            return;
        }

        if (event === 'sandboxed') {
            self.emit('sandboxed', msg);
            return;
        }

        if (event === 'mistnode') {
            self.emit('mistnode', msg);
            return;
        }
        
        console.log('Received an event from native addon which was unhandled.', event, msg);
    }, opts);
}

inherits(Addon, EventEmitter);

Addon.prototype.request = function(target, payload) {
    if (Buffer.isBuffer(payload)) { console.log('A buffer was sent to Addon', new Error().stack); }
    if (typeof payload === 'object') { payload = BSON.serialize(payload); }
    this.api.request(target, payload);
};

function Mist(opts) {
    //console.log("Nodejs new Mist()", opts);
    
    var self = this;
    this.requests = {};
    this.invokeCb = {};
    this.writeCb = function() {};

    //console.log("2. Creating the MistApi.StreamingWorker.");

    if (!opts) { opts = {}; }

    // Default to MistApi
    if (!opts.type) { opts.type = 2; }
    
    this.opts = opts;
    
    //console.log('Starting with opts:', opts);
    
    setTimeout(function() { self.emit('ready'); }, 200);

    this.sandboxes = {};

    this.addon = new Addon(opts);
    
    this.addon.on('sandboxed', function(msg) {
        var id = msg.ack || msg.sig || msg.end || msg.err;

        //console.log("the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

        if(typeof self.requests[id] === 'function') {
            self.requests[id](msg);

            if(!msg.sig) {
                delete self.requests[id];
            }
        }
    });

    this.addon.on('mist', function(msg) {
        var id = msg.ack || msg.sig || msg.end || msg.err;

        //console.log("mist: the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

        if(typeof self.requests[id] === 'function') {
            self.requests[id](msg);

            if(!msg.sig) {
                delete self.requests[id];
            }
        } else {
            console.log('Request not found for response:', id, self, self.requests);
        }
    });

    this.node = new MistNodeInner(this.addon);
    this.wish = new WishAppInner(this.addon);
    
    // keep track of instances to shut them down on exit.
    instances.push(this);
}

inherits(Mist, EventEmitter);

Mist.prototype.request = function(op, args, cb) {
    return this.requestBare(op, args, function(res) {
        //console.log('requestBare cb:', arguments);
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

Mist.prototype.requestBare = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;

    //console.log("Making request", request, this);
    
    this.addon.request("mist", request);
    
    return id;
};

Mist.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.addon.request("mist", request);
};

Mist.prototype.registerSandbox = function(sandbox) {
    this.sandbox = sandbox;
};

Mist.prototype.shutdown = function() {
    this.addon.request("kill", { kill: true });
};

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

MistNodeInner.prototype.request = function(op, args, cb) {
    if (typeof cb !== 'function') { console.log("not function:", new Error().stack); }
    return this.requestBare(op, args, function(res) {
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

MistNodeInner.prototype.requestBare = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: typeof args === 'undefined' ? [] : args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.addon.request("mistnode", request);

    return id;
};

MistNodeInner.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.addon.request("mistnode", request);
};

function MistNode(opts) {
    //console.log("Nodejs new Mist()", opts);
    
    var self = this;
    this.requests = {};
    this.readCb = {};
    this.writeCb = {};
    this.invokeCb = {};
    this.peers = [];

    if (!opts) { opts = {}; }

    // Default to MistApi
    if (!opts.type) { opts.type = 3; }
    
    this.opts = opts;

    this.addon = new Addon(opts);

    var node = new MistNodeInner(this.addon);
    node.wish = new WishAppInner(this.addon);
    
    // keep track of instances to shut them down on exit.
    instances.push(this);
    
    // FIXME get ready signal from wish-app connecting to core
    setTimeout(function() { self.emit('ready'); }, 200);
    
    return node;
}

inherits(MistNode, EventEmitter);

MistNode.prototype.create = function(model, cb) {
    var id = ++sharedId;
    var request = { model: model };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.addon.request("mistnode", request);
};

MistNode.prototype.endpointAdd = function(epid, endpoint) {
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

MistNode.prototype.endpointRemove = function(epid) {
    this.addon.request("mistnode", { endpointRemove: epid });
};

// register read handler for epid
MistNode.prototype.read = function(epid, cb) {
    this.readCb[epid] = cb;
};

// register write handler for epid
MistNode.prototype.write = function(epid, cb) {
    this.writeCb[epid] = cb;
};

// register invoke handler for epid
MistNode.prototype.invoke = function(epid, cb) {
    this.invokeCb[epid] = cb;
};

MistNode.prototype.changed = function(epid) {
    var request = { changed: epid };
    
    this.addon.request("mistnode", request);
};

MistNode.prototype.request = function(peer, op, args, cb) {
    return this.requestBare(peer, op, args, function(res) {
        //console.log('requestBare cb:', arguments);
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

MistNode.prototype.requestBare = function(peer, op, args, cb) {
    var id = ++sharedId;
    var request = { peer: peer, op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;

    //console.log("Making request", request, this);
    
    this.addon.request("mistnode", request);
    
    return id;
};

MistNode.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.addon.request("mistnode", request);
};

MistNode.prototype.shutdown = function() {
    this.addon.request("kill", { kill: true });
};

function MistNodeSimple(node) {
    this.node = node;
}

function Sandboxed(mist, sandboxId) {
    if (!mist || !mist.opts || !mist.opts.type === 2) {
        throw new Error('Sandbox constructor parameter 1 must be Mist of type 2.');
    }
    
    if ( !Buffer.isBuffer(sandboxId) || sandboxId.length !== 32 ) {
        console.log("sandboxId:", sandboxId);
        throw new Error('Sandbox constructor parameter 2 must be Buffer(len:32).');
    }
    
    this.addon = mist.addon;
    this.sandboxId = sandboxId;
    this.mist = mist;
    mist.registerSandbox(this);
}

Sandboxed.prototype.request = function(op, args, cb) {
    return this.requestBare(op, args, function(res) {
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });    
};

Sandboxed.prototype.requestBare = function(op, args, cb) {
    var id = ++sharedId;
    var sandboxArgs = [this.sandboxId].concat(args);
    
    //console.log('sandboxed.'+op+'(', sandboxArgs, '):', id);
    var request = { op: 'sandboxed.'+op, args: sandboxArgs, id: id };
    
    // store callback for response in the mist object
    this.mist.requests[id] = cb;
    
    this.addon.request('sandboxed', request);

    return id;
};

Sandboxed.prototype.requestCancel = function(id) {
    var self = this;
    var request = { cancel: id, sandbox: this.sandboxId };
    
    setTimeout(function() { if(self.mist.requests[id]) { delete self.mist.requests[id]; } }, 500);
    
    this.addon.request('sandboxed', request);
};

function copy(that) {
    var copy = {};
    
    for(var i in that) { copy[i] = that[i]; }
    
    return copy;
}

function WishAppInner(addon) {
    var self = this;
    this.peers = [];
    this.requests = {};
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
    var id = ++sharedId;
    var request = { op: op, args: typeof args === 'undefined' ? [] : args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.addon.request("wish", request);

    return id;
};

WishAppInner.prototype.cancel = function(id) {
    var request = { cancel: id };
    this.addon.request("wish", request);
};

function WishApp(opts) {
    if (!opts) { opts = {}; }
    opts = copy(opts);    
    
    // force type to WishApp
    opts.type = 4;

    var self = this;
    this.peers = [];
    this.requests = {};
    this.invokeCb = {};

    this.opts = opts;
    
    if ( Array.isArray(opts.protocols) ) {
        if (opts.protocols.length === 1) {
            opts.protocols =  opts.protocols[0];
        } else if (opts.protocols.length === 0) {
            delete opts.protocols;
        } else {
            throw new Error('WishApp requires 0 or one protocols (multiple not yet supported)');
        }
    } else if (!opts.protocols) {
        // fine
    } else {
        throw new Error('WishApp protocols must be array or non-existing.');
    }
    
    setTimeout(function() { self.emit('ready'); }, 200);
    
    this.api = new MistApi(function (event, data) {
        if (!event && !data) { console.log('MistApi callback with no arguments..'); return; }
        if (event === 'done') { return; }

        var msg = null;

        try {
            msg = BSON.deserialize(data);
        } catch(e) {
            return console.log('Warning! Non BSON message from plugin.', arguments, event, data);
        }

        if (event === 'online') {
            if (typeof self.onlineCb === 'function') { self.onlineCb(msg.peer); }

            self.peers.push(msg.peer);

            return;
        }

        if (event === 'offline') {
            if (typeof self.offlineCb === 'function') { self.offlineCb(msg.peer); }

            return;
        }

        if (event === 'frame') {
            if (typeof self.frameCb === 'function') { self.frameCb(msg.peer, msg.frame); }

            return;
        }

        if (event === 'wish') {

            var id = msg.ack || msg.sig || msg.end || msg.err;

            //console.log("the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

            if(typeof self.requests[id] === 'function') {
                self.requests[id](msg);

                if(!msg.sig) {
                    delete self.requests[id];
                }
            } else {
                console.log('Request not found for response:', id, self, self.requests);
            }
            return;
        }
        
        console.log('Received an event from native addon which was unhandled.', arguments);
    }, opts);
    
    // keep track of instances to shut them down on exit.
    instances.push(this);
    
}

inherits(WishApp, EventEmitter);

WishApp.prototype.send = function(peer, message, cb) {
    this.request('services.send', [peer, message], cb || function() {});
};

WishApp.prototype.broadcast = function(message) {
    for(var i in this.peers) {
        this.request('services.send', [this.peers[i], message], function() {});
    }
};

WishApp.prototype.request = function(op, args, cb) {
    if (typeof cb !== 'function') { console.log("not function:", new Error().stack); }
    return this.requestBare(op, args, function(res) {
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

WishApp.prototype.requestBare = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: typeof args === 'undefined' ? [] : args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.request("wish", BSON.serialize(request));

    return id;
};

WishApp.prototype.cancel = function(id) {
    var request = { cancel: id };
    this.api.request("wish", BSON.serialize(request));
};

WishApp.prototype.disconnect = function() {
    this.api.request("kill", BSON.serialize({ kill: true }));
};

WishApp.prototype.shutdown = function() {
    this.api.request("kill", BSON.serialize({ kill: true }));
};

process.on('exit', function() {
    for(var i in instances) {
        try { instances[i].shutdown(); } catch(e) { console.log('MistApi instance '+i+' shutdown() command failed.', e); }
    }
});

module.exports = {
    Mist: Mist,
    MistNode: MistNode,
    MistNodeSimple: MistNodeSimple,
    Sandboxed: Sandboxed,
    WishApp: WishApp };


