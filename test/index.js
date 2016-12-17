var Mist = require('../').Mist;
var assert = require('assert');
var BSON = require('wish-bson').BSONPure.BSON;
var inspect = require('util').inspect;
var model = require('./../doc/model.json');

/*
var Mist = require('../').Mist;

var mist = new Mist();

mist.addEndpoint('mybool', {
    write: function(value, opts) {
        console.log("Write", value, opts);
    }
});

mist.update('mybool', false);
*/

describe('MistApi', function () {
    var mist = new Mist();
    
    // callback 
    mist.write(function(data) {
        console.log("mist write:", data);
    });
    
    it('should create a mist node', function (done) {
        this.timeout(10000);
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
        
        setTimeout(function() { clearInterval(interval); }, 8000);
        setTimeout(done, 9000);
    });

    it('should shut down the mist plugin', function (done) {
        mist.shutdown();
        setTimeout(done, 1000);
    });
});
