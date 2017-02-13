var EventEmitter = require("events").EventEmitter;
var Mist = require('../index.js').MistNode;
var model = require('./gps.json');
var util = require("util");

console.log('GPS running');

var mist = new Mist({ name: model.device, corePort: 9094 });

// callback 
mist.write(function(epid, data) {
    console.log(":::::::::::::::mist write:", epid, data);
});

// callback 
mist.invoke('config', function(data, cb) {
    //console.log("mist invoke:", data);
    
    switch(typeof data) {
        case 'number':
            cb({ an: 'object-response', echo: data });
            break;
        case 'boolean':
            cb({ an: 'object-response', echo: data });
            break;
        case 'string':
            cb({ an: 'object-response', echo: data });
            break;
        case 'object':
            cb({ an: 'object-response', echo: data });
            break;
        default:
            cb("I did not get that.");
            break;
    }
    
    
});

mist.create(model);

process.on('exit', function() {
    console.log("exiting, doing cleanup.");
    mist.shutdown();
});


function Gps() {
    var self = this; 

    this.deviceData = {};

    function update() {
        self.emit('update', { lat: 60.4042 + Math.sin(Date.now()/10000)*0.0002, lon: 25.6814 + Math.cos(Date.now()/10000)*0.0005, accuracy: 10 });
    }

    setInterval(update, 5000);
    process.nextTick(update);
}

util.inherits(Gps, EventEmitter);

Gps.prototype.write = function(feature, value) {
    this.deviceData[feature] = value;
    this.emit('change', feature, value);
};

var c = 1;

function MistGps() {
    var sensor = new Gps();

    sensor.on('update', function (data) {
        mist.update('lon', data.lon);
        mist.update('lat', data.lat);
        mist.update('accuracy', data.accuracy);
        mist.update('counter', c++);
        console.log("GPS update", data);
    });
}

var gps = new MistGps();
