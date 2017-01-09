//var MistApi = require('bindings')('MistApi');

if(process.env.BUILD) {
    var MistApi = require('./build/Release/MistApi.node');
} else if (process.arch === 'arm' && process.platform === 'linux' ) {
    var MistApi = require('./bin/MistApi-arm-eabi5.node');
} else if (process.platform === 'darwin') {
    var MistApi = require('./bin/MistApi-osx.node');
} else {
    var MistApi = require('./bin/MistApi.node');
}

var bson = require('wish-bson');
var BSON = new bson();
var EventEmitter = require('events');
var emitter = new EventEmitter();


function Mist(opts) {
    var self = this;
    this.id = 0;
    this.requests = {};
    this.invokeCb = {};

    //console.log("2. Creating the MistApi.StreamingWorker.");

    if (!opts) { opts = {}; }

    // Default to MistApi
    if (!opts.type) { opts.type = 2; }

    this.api = new MistApi.StreamingWorker(
        function (event, value, data) {
            //console.log("Event from streaming worker", event, data);
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
            
            emitter.emit(event, value);
            
            //console.log("got something from Addon...", event, value);

            if( Buffer.isBuffer(data) && data.length >= 5 ) {
                var msg = BSON.deserialize(data);
                
                var id = msg.ack || msg.sig || msg.end || msg.err;
                
                //console.log("the answer is:", inspect(msg, { colors: true, depth: 10 }));
                
                if(typeof self.requests[id] === 'function') {
                    if (msg.err) {
                        self.requests[id](true, { code: msg.code, msg: msg.msg });
                    } else {
                        self.requests[id](null, msg.data);
                    }
                    
                    if(!msg.sig) {
                        delete self.requests[id];
                    }
                }
            }
        },
        function () {
            emitter.emit("close");
        },
        function (error) {
            emitter.emit("error", error);
        },
        opts);

    //emitter.on('done', function() { console.log("MistApi: C99 plugin has shut down gracefully."); });
}

Mist.prototype.shutdown = function() {
    this.api.sendToAddon("kill", 1, BSON.serialize({ kill: true }));
};

Mist.prototype.create = function(model, cb) {
    var id = ++this.id;
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
    var id = ++this.id;
    var request = { op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.sendToAddon("mist", 1, BSON.serialize(request));

    return id;
};

Mist.prototype.requestCancel = function(id) {
    var request = { cancel: id };
    this.api.sendToAddon("mist", 1, BSON.serialize(request));
};

Mist.prototype.wish = function(op, args, cb) {
    var id = ++this.id;
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

function MistNode(opts) {
    //console.log("creating new MistNode.....");
    if (!opts) { opts = {}; }
    
    // force type to MistNodeApi
    opts.type = 3;
    
    return new Mist(opts);
}

module.exports = {
    Mist: Mist,
    MistNode: MistNode };


