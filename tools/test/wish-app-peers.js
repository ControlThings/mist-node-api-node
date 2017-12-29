var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

var app1;
var app2;

var mistIdentity1;
var mistIdentity2;

describe('WishApp Peers', function () {
    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        app1.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        console.log('before 2');
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        app2.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        util.clear(app1, done);
    });

    before(function(done) {
        util.clear(app2, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    before(function(done) {
        app1.request('identity.import', [BSON.serialize(mistIdentity2)], function(err, data) {
            done();
        });
    });
    
    before(function(done) {
        app1.request('identity.list', [], function(err, data) {
            console.log('identity.list:', err, data);
            done();
        });
    });
    
    before(function(done) {
        app2.request('identity.import', [BSON.serialize(mistIdentity1)], function(err, data) {
            done();
        });
    });
    
    it('should find the remote peer', function(done) {
        this.timeout(5000);
        //console.log('Testing peer');
        app1.onlineCb = function(peer) {
            //console.log('Peer:', peer);
            if ( Buffer.compare(peer.ruid, mistIdentity2.uid) === 0 && peer.protocol === 'test') {
                done();
                done = function() {};
            }
        };
        //done();
    });
});