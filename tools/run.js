var Mist = require('../index.js').MistNode;
var BSON = require('bson-buffer');
var inspect = require('util').inspect;
var model = require('../doc/model.json');

var mist = new Mist({ corePort: 9094 });

// callback 
mist.write(function(ep, value) {
    console.log("mist write:", ep, value);
});

// callback 
mist.invoke('config', function(args, cb) {
    console.log("mist invoke:", args);

    cb({ yo: [5,4], all: args });
});

mist.create(model);

var bool = false;
var axis0 = 0;

var interval = setInterval(function() {
    bool = !bool;
    axis0 = Math.sin(Date.now()/4000);

    mist.update('axis0', axis0);
    mist.update('axis1', Math.round(axis0));
    mist.update('button0', bool);
}, 1000);

process.on('exit', function() {
    console.log("exiting, doing cleanup.");
    mist.shutdown();
});