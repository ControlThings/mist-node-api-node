var supportedVersionList = [ "v6", "v8", "v10" ];
var currentMajorVersion = process.version.split('.')[0];

var supported = false;
for (v in supportedVersionList) {
    if (currentMajorVersion === supportedVersionList[v]) {
        supported = true;
        break;
    }
}

if (!supported) {
    console.log('MistApi is a native addon, which is not supported by Node.js version ('+process.version+'), supports' + supportedVersionList);
    process.exit(1);
}

var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

var bson = require('bson-buffer');
var BSON = new bson();

var MistApi = null;

if (process.env.DEBUG) {
    MistApi = require('./build/Debug/MistApi.node').MistApi;
    console.log("                                   *** Using debug build ***");
} else {
    if(process.env.BUILD) {
        MistApi = require('./build/Release/MistApi.node').MistApi;
    } else {
        var arch = process.arch;
        var platform = process.platform;
        var version = process.version;
        
        try {
            MistApi = require('./bin/MistApi-'+arch+'-'+platform+'-' + currentMajorVersion + '.node').MistApi;
        } catch (e) {
            console.log(e);
            console.log('MistApi is a native addon, which is not supported or currently not bundled for your arch/platform or version ('+arch+'/'+platform+' '+version+').');
            process.exit(1);
        }
    }
}

// instances of native Addons, used for shutting them down
var instances = [];

function Addon(opts) {
    //console.log('new Addon instance:', opts.name);
    var self = this;
    this.sharedRequestId = 0;
    
    var id = this.sharedRequestId;
    
    /*setInterval(function() {
        if (id !== self.sharedRequestId) {
            console.log('sharedRequestId changed:', self.sharedRequestId, opts.name);
            id = self.sharedRequestId;
        }
    }, 50);
    */
    
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
        
        if (event === 'ready') {
            self.emit('ready', msg.ready, msg.sid);
            if (typeof self.readyCb === 'function') { self.readyCb(msg.ready, msg.sid); }
            
            return;
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
            
            if (typeof self.frameCb === 'function') { self.frameCb(msg.peer, msg.frame); }

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
    
    // keep track of instances to shut them down on exit.
    instances.push(this);
}

inherits(Addon, EventEmitter);

Addon.prototype.request = function(target, payload) {
    if (Buffer.isBuffer(payload)) { console.log('A buffer was sent to Addon', new Error().stack); }
    if (typeof payload === 'object') { payload = BSON.serialize(payload); }
    this.api.request(target, payload);
};

Addon.prototype.shutdown = function() {
    this.request("kill", { kill: true });
};


process.on('exit', function() {
    for(var i in instances) {
        try { instances[i].shutdown(); } catch(e) { console.log('MistApi instance '+i+' shutdown() command failed.', e); }
    }
});


module.exports.Addon = Addon;
