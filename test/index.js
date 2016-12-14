var Mist = require('../').Mist;
var assert = require('assert');
var BSON = require('wish-bson').BSONPure.BSON;
var inspect = require('util').inspect;

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

    it('should create a mist node', function (done) {
        this.timeout(10000);
        mist.create();
        
        var bool = false;
        
        var interval = setInterval(function() {
            bool = !bool;
            
            console.log("changing state to", bool);
            mist.update('state', bool);
        }, 600);
        
        setTimeout(function() { clearInterval(interval); }, 8000);
        setTimeout(done, 9000);
    });

    it('should shut down the mist plugin', function (done) {
        mist.shutdown();
        setTimeout(done, 1000);
    });
});
