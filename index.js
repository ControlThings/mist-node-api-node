if (!process.version.substr(0, 3) === 'v6.') {
    console.log('MistApi is a native addon, which is not supported by Node.js version ('+process.version+'), requires v6.x.x., tested on v6.9.2.');
    process.exit(1);
}

if (process.env.DEBUG) {
    var MistApi = require('./build/Debug/MistApi.node');
} else {
    if(process.env.BUILD) {
        var MistApi = require('./build/Release/MistApi.node');
    } else if (process.arch === 'x64' && process.platform === 'linux' ) {
        var MistApi = require('./bin/MistApi.node');
    } else {
        console.log('MistApi is a native addon, which is not supported by your platform/arch ('+process.platform+'/'+process.arch+').');
        process.exit(1);
    }
}
    
/*
else if (process.arch === 'arm' && process.platform === 'linux' ) {
    var MistApi = require('./bin/MistApi-arm-eabi5.node');
} else if (process.platform === 'darwin') {
    var MistApi = require('./bin/MistApi-osx.node');
} else {
    var MistApi = require('./bin/MistApi.node');
}
*/

var bson = require('bson-buffer');
var BSON = new bson();
var EventEmitter = require('events');
var emitter = new EventEmitter();

// request id shared by all
var sharedId = 0;

var themist;

function Mist(opts) {
    
    //console.log("Nodejs new Mist()");
    themist = this;
    
    var self = this;
    this.requests = {};
    this.invokeCb = {};

    //console.log("2. Creating the MistApi.StreamingWorker.");

    if (!opts) { opts = {}; }

    // Default to MistApi
    if (!opts.type) { opts.type = 2; }
    
    this.opts = opts;
    
    //console.log('Starting with opts:', opts);

    this.api = new MistApi.StreamingWorker(
        function (event, value, data) {
            //console.log("Event from streaming worker", arguments);
            //console.log("Event from streaming worker", event, Buffer.isBuffer(data) ? BSON.deserialize(data) : 'Not Buffer');

            if (event === 'done') {
                // Streaming worker is done and has shut down
                return;
            }
            
            if (event === 'write' && typeof self.writeCb === 'function') {
                var msg = BSON.deserialize(data);
                self.writeCb(msg.epid, msg.data);
                return;
            }
            
            if (event === 'invoke') {
                var msg = BSON.deserialize(data);
                
                if(typeof self.invokeCb[msg.epid] === 'function') {
                    self.invokeCb[msg.epid]( msg.args, (function (id) { return function(data) { var request = { invoke: id, data: data }; self.api.sendToAddon("mistnode", 1, BSON.serialize(request)); }; })(msg.id) );
                } else {
                    console.log("There is no invoke function registered for", msg.epid );
                }
                
                return;
            }
            
            if (event === 'sandboxed') {
                if( Buffer.isBuffer(data) && data.length >= 5 ) {
                    
                    var msg = BSON.deserialize(data);

                    var id = msg.ack || msg.sig || msg.end || msg.err;

                    //console.log("the answer is:", require('util').inspect(msg, { colors: true, depth: 10 }));

                    if(typeof self.requests[id] === 'function') {
                        if (msg.err) {
                            if(typeof msg.data === 'object') {
                                self.requests[id](true, { code: msg.data.code, msg: msg.data.msg });
                            } else {
                                self.requests[id](true, { code: 100, msg: "Invalid error returned." });
                            }
                        } else {
                            self.requests[id](null, msg.data);
                        }

                        if(!msg.sig) {
                            delete self.requests[id];
                        }
                    }
                }
                return;
            }
            
            emitter.emit(event, value);
            
            //console.log("got something from Addon...", event, value);

            if( Buffer.isBuffer(data) && data.length >= 5 ) {
                var msg = BSON.deserialize(data);
                
                var id = msg.ack || msg.sig || msg.end || msg.err;
                
                //console.log("the answer is:", inspect(msg, { colors: true, depth: 10 }));
                
                if(typeof self.requests[id] === 'function') {
                    if (msg.err) {
                        if(typeof msg.data === 'object') {
                            self.requests[id](true, { code: msg.data.code, msg: msg.data.msg });
                        } else {
                            self.requests[id](true, { code: 100, msg: "Invalid error returned." });
                        }
                    } else {
                        self.requests[id](null, msg.data);
                    }
                    
                    if(!msg.sig) {
                        delete self.requests[id];
                    }
                } else {
                    console.log('Request not found for response:', id, self, themist.requests);
                }
            }
        },
        opts);

    //emitter.on('done', function() { console.log("MistApi: C99 plugin has shut down gracefully."); });
}

Mist.prototype.shutdown = function() {
    this.api.sendToAddon("kill", 1, BSON.serialize({ kill: true }));
};

Mist.prototype.create = function(model, cb) {
    var id = ++sharedId;
    var request = { model: model };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.sendToAddon("mistnode", 1, BSON.serialize(request));
};

Mist.prototype.update = function(ep, value) {
    var request = { update: ep, value: value };
    
    this.api.sendToAddon("mistnode", 1, BSON.serialize(request));
};

Mist.prototype.request = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;

    //console.log("Making request", request, this);
    
    this.api.sendToAddon("mist", 1, BSON.serialize(request));
    
    return id;
};

Mist.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.api.sendToAddon("mist", 1, BSON.serialize(request));
};

Mist.prototype.wish = function(op, args, cb) {
    var id = ++sharedId;
    var request = { op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.sendToAddon("wish", 1, BSON.serialize(request));

    return id;
};

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
    var id = ++sharedId;
    var sandboxArgs = [this.sandboxId].concat(args);
    var request = { op: 'sandboxed.'+op, args: sandboxArgs, id: id };
    
    // store callback for response in the mist object
    this.mist.requests[id] = cb;
    
    this.api.sendToAddon('sandboxed', 1, BSON.serialize(request));

    return id;
};

Sandboxed.prototype.requestCancel = function(id) {
    var self = this;
    var request = { cancel: id, sandbox: this.sandboxId };
    
    setTimeout(function() { if(self.mist.requests[id]) { delete self.mist.requests[id]; } }, 500);
    
    this.api.sendToAddon('sandboxed', 1, BSON.serialize(request));
};

module.exports = {
    Mist: Mist,
    MistNode: MistNode,
    Sandboxed: Sandboxed };


