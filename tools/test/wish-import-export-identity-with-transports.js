var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var aliceApp;
var bobApp;

var aliceIdentity;
var bobIdentity;

var bobWldEntry;

/*
 * Test exporting and importing identities, and verify that multiple transports are also correctly handled.
 * 
 * This test expects the test suite to have two cores, at app ports at 9095, 9096.
 * 
 * Test test first adds a couple of relay servers. The test ensures identities Alice and Bob. 
 * 
 * @returns {undefined}
 */

describe('Wish core import export identity with many transports', function () {
    var aliceRelayList;
    
    before(function(done) {
        console.log('before 1');
         aliceApp = new WishApp({ name: 'app1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

         aliceApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        console.log('before 2');
        bobApp = new WishApp({ name: 'app2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        bobApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        util.clear( aliceApp, done);
    });
    
    before(function(done) {
        util.clear(bobApp, done);
    });
    
    before(function(done) {
        console.log('before adding relay servers');
        
        aliceApp.request('relay.add', [ '127.0.0.1:40000'], function(err, data) {
            if (err) { done(new Error('Could not add a relay server')); }
        });
        aliceApp.request('relay.list', [], function(err, data) {
            if (err) { done(new Error('Could not list relay servers')); }
            console.log('Relays: ', data);  
            aliceRelayList = data;
            done();
        });
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(aliceApp, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity( bobApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            done(); 
        });
    });
    
    before(function(done) {
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
    
    it('Alice should have expected transports', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.export', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            var export_meta = BSON.deserialize(result.meta)
            //console.log("Alice meta:", export_meta);
            var transports = export_meta['transports'];
            //console.log("transports:", transports);
            //console.log("aliceRelayList:", aliceRelayList);
            
            /* Check that we have the expected transports in Alice's identity export. Note that they need not be in any particular order, and that transports can have other items than relays too! */
            var cnt = 0;
            var expectedCnt = 2;
            for (i in transports) {
                var transport_ip_port = transports[i].split("wish://")[1];
                for (j in aliceRelayList) {
                    if (transport_ip_port === aliceRelayList[j].host) {
                        cnt++;
                    }
                }
            }
            if (cnt === expectedCnt) {
                done();
            }
        })
    });
    
    
    
});