//var MistApi = require('bindings')('MistApi');
var MistApi = require('./bin/MistApi.node');
var BSON = require('wish-bson').BSONPure.BSON;
var inspect = require('util').inspect;
var EventEmitter = require('events');
var emitter = new EventEmitter();


function Mist() {
    var self = this;
    this.id = 0;
    this.requests = {};

    //console.log("Creating the MistApi.StreamingWorker.");

    this.api = new MistApi.StreamingWorker(
        function (event, value, data) {
            if (event === 'write' && typeof self.writeCb === 'function') {
                self.writeCb(BSON.deserialize(data));
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
                        self.requests[id](true, msg.data);
                    } else {
                        self.requests[id](true, msg.data);
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
        null);

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
};

Mist.prototype.wish = function(op, args, cb) {
    var id = ++this.id;
    var request = { op: op, args: args, id: id };
    
    // store callback for response
    this.requests[id] = cb;
    
    this.api.sendToAddon("wish", 1, BSON.serialize(request));
};

Mist.prototype.write = function(cb) {
    this.writeCb = cb;
};

module.exports = {
    Mist: Mist,
    MistApi: MistApi };


