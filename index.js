var MistApi = require('./addon.js');

var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

var bson = require('bson-buffer');
var BSON = new bson();

// request id shared by all
var sharedId = 0;

var instances = [];

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

        if( Buffer.isBuffer(data) && data.length >= 5 ) {
            msg = BSON.deserialize(data);
        }

        if (!msg) { return console.log('Warning! Non BSON message from plugin.', arguments, event, data); }

        if (event === 'online') {
            if (typeof self.onlineCb === 'function') { self.onlineCb(msg.peer); }
            
            return;
        }

        if (event === 'offline') {
            if (typeof self.offlineCb === 'function') { self.offlineCb(msg.peer); }

            return;
        }

        if (event === 'frame') {
            var payload = BSON.deserialize(msg.frame);

            if (typeof self.frameCb === 'function') { self.frameCb(msg.peer, payload); }

            return;
        }

        if (event === 'write' && typeof self.writeCb === 'function') {
            self.writeCb(msg.epid, msg.data);
            return;
        }

        if (event === 'invoke') {
            if(typeof self.invokeCb[msg.epid] === 'function') {
                self.invokeCb[msg.epid](msg.args, (function (id) {
                    return function(data) {
                        var request = { invoke: id, data: data };
                        self.api.request("mistnode", BSON.serialize(request));
                    }; 
                })(msg.id));
            } else {
                console.log("There is no invoke function registered for", msg.epid );
            }

            return;
        }

        if (event === 'sandboxed') {
            var id = msg.ack || msg.sig || msg.end || msg.err;

            //console.log("the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

            if(typeof self.requests[id] === 'function') {
                self.requests[id](msg);

                if(!msg.sig) {
                    delete self.requests[id];
                }
            }
            return;
        }

        if (event === 'mist' || event === 'wish') {

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

Mist.prototype.shutdown = function() {
    this.api.request("kill", BSON.serialize({ kill: true }));
};

Mist.prototype.create = function(model, cb) {
    var id = ++sharedId;
    var request = { model: model };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.request("mistnode", BSON.serialize(request));
};

Mist.prototype.update = function(ep, value) {
    var request = { update: ep, value: value };
    
    this.api.request("mistnode", BSON.serialize(request));
};

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
    
    this.api.request("mist", BSON.serialize(request));
    
    return id;
};

Mist.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.api.request("mist", BSON.serialize(request));
};

Mist.prototype.wish = function(op, args, cb) {
    return this.wishBare(op, args, function(res) {
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

Mist.prototype.wishBare = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: typeof args === 'undefined' ? [] : args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.request("wish", BSON.serialize(request));

    return id;
};

Mist.prototype.wishCancel = function(id) {
    var request = { cancel: id };
    this.api.request("wish", BSON.serialize(request));
};

Mist.prototype.core = Mist.prototype.wish;

Mist.prototype.coreCancel = Mist.prototype.wishCancel;

Mist.prototype.write = function(cb) {
    this.writeCb = cb;
};

Mist.prototype.invoke = function(epid, cb) {
    this.invokeCb[epid] = cb;
    //console.log("Registering invoke for epid:", epid, this.invokeCb);
};

Mist.prototype.registerSandbox = function(sandbox) {
    this.sandbox = sandbox;
};

function MistNode(opts) {
    //console.log("creating new MistNode.....");
    if (!opts) { opts = {}; }
    
    // force type to MistNodeApi
    opts.type = 3;
    
    return new Mist(opts);
}

function Sandboxed(mist, sandboxId) {
    if (!mist || !mist.opts || !mist.opts.type === 2) {
        throw new Error('Sandbox constructor parameter 1 must be Mist of type 2.');
    }
    
    if ( !Buffer.isBuffer(sandboxId) || sandboxId.length !== 32 ) {
        console.log("sandboxId:", sandboxId);
        throw new Error('Sandbox constructor parameter 2 must be Buffer(len:32).');
    }
    
    this.api = mist.api;
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
    
    this.api.request('sandboxed', BSON.serialize(request));

    return id;
};

Sandboxed.prototype.requestCancel = function(id) {
    var self = this;
    var request = { cancel: id, sandbox: this.sandboxId };
    
    setTimeout(function() { if(self.mist.requests[id]) { delete self.mist.requests[id]; } }, 500);
    
    this.api.request('sandboxed', BSON.serialize(request));
};

function copy(that) {
    var copy = {};
    
    for(var i in that) { copy[i] = that[i]; }
    
    return copy;
}

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
        if (!event && !data) { return; }
        if (event === 'done') { return; }

        var msg = null;

        if( Buffer.isBuffer(data) && data.length >= 5 ) {
            msg = BSON.deserialize(data);
        }

        if (!msg) { return console.log('Warning! Non BSON message from plugin.', arguments, event, data); }

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
    Sandboxed: Sandboxed,
    WishApp: WishApp };


