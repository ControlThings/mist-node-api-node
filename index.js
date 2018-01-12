var Addon = require('./addon.js').Addon;
var WishAppInner = require('./wish-app-inner.js').WishAppInner;
var MistNodeInner = require('./mist-node-inner.js').MistNodeInner;

var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

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
        var id = msg.ack || msg.sig || msg.end || msg.err || msg.fin;

        //console.log("the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

        if(typeof self.requests[id] === 'function') {
            self.requests[id](msg);

            if(!msg.sig) {
                delete self.requests[id];
            }
        }
    });

    this.addon.on('mist', function(msg) {
        var id = msg.ack || msg.sig || msg.end || msg.err || msg.fin;

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
    
    this.node.request = function(op, args, cb) { cb(true, { code: 1100, msg: 'node.request is not supported from MistApi. Use request on MistAPi and prepend mist., i.e. mist.control.invoke instead of control.invoke.' }) }
}

inherits(Mist, EventEmitter);

Mist.prototype.request = function(op, args, cb) {
    return this.requestBare(op, args, function(res) {
        //console.log('requestBare cb:', arguments);
        if(res.fin) { return cb(true, { end: true }); }
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

Mist.prototype.requestBare = function(op, args, cb) {
    var id = ++this.addon.sharedRequestId;
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

function MistNode(opts) {
    if (!opts) { opts = {}; }

    // Default to MistApi
    if (!opts.type) { opts.type = 3; }
    
    this.addon = new Addon(opts);

    var node = new MistNodeInner(this.addon);
    node.wish = new WishAppInner(this.addon);
    
    return node;
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
        if(res.fin) { return cb(true, { end: true }); }
        if(res.err) { return cb(true, res.data); }
        
        cb(null, res.data);
    });
};

Sandboxed.prototype.requestBare = function(op, args, cb) {
    var id = ++this.addon.sharedRequestId;
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
    
    setTimeout(() => {
        if (typeof self.mist.requests[id] === 'function') {
            self.mist.requests[id](true, { timeout: true });
            delete self.mist.requests[id]; 
        }
    }, 1500);
    
    this.addon.request('sandboxed', request);
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
    
    var addon = new Addon(opts);

    var wish = new WishAppInner(addon);
    
    // FIXME this is required by multi-mist.js test, but should be removed
    wish.opts = opts;
    
    return wish;
}

module.exports = {
    Mist: Mist,
    MistNode: MistNode,
    Sandboxed: Sandboxed,
    WishApp: WishApp };


