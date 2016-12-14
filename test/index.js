var MistApi = require('../').MistApi;
var Mist = require('../').Mist;
var assert = require('assert');
var BSON = require('wish-bson').BSONPure.BSON;
var inspect = require('util').inspect;

describe('MistApi', function () {
    var mist = new Mist();
    
    it('mist.listServices', function (done) {
        var timeout = setTimeout(function() { done(new Error("Timeout")); }, 200);

        mist.request('mist.listServices', [], function(err, data) {
            console.log("Got the response:", err, data);
            clearTimeout(timeout);
            done();
        });
    });
    
    it('Passthrough to core identity.list', function (done) {
        var timeout = setTimeout(function() { done(new Error("Timeout")); }, 200);

        mist.wish('identity.list', [], function(err, data) {
            console.log("Got the response:", err, data);
            clearTimeout(timeout);
            done();
        });
    });
    
    it('Passthrough to core identity.create', function (done) {
        var timeout = setTimeout(function() { done(new Error("Timeout")); }, 200);

        mist.wish('identity.create', ['node.js'], function(err, data) {
            console.log("Got the response:", err, data);
            mist.wish('identity.remove', [data.uid], function(err, data) {
                console.log("Got the response:", err, data);
                clearTimeout(timeout);
                done();
            });
        });
    });
    
    it('should shut down the mist plugin', function (done) {
        mist.shutdown();
        setTimeout(done, 100);
    });
});
