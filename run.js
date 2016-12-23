var Mist = require('./').Mist;
var assert = require('assert');
var BSON = require('wish-bson');
var inspect = require('util').inspect;
var model = require('./doc/model.json');

var mist = new Mist();

// callback 
mist.write(function(data) {
    console.log("mist write:", data);
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
}, 300);

process.on('exit', function() {
    console.log("exiting, doing cleanup.");
    mist.shutdown();
});