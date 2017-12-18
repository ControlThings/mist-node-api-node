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
 * 
 * This test expects the test suite to have two cores, at app ports at 9095, 9096.
 * 
 * Test test first adds a couple of relay servers. The test ensures identities Alice and Bob. 
 * 
 * @returns {undefined}
 */

describe('Wish core import export identity with many transports', function () {
    var aliceRelayList;
    var newRelayServer = '127.0.0.1:40000';
    
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
        
        aliceApp.request('relay.add', [ newRelayServer ], function(err, data) {
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
    var bobExport;
    
    before(function(done) {
        util.ensureIdentity( bobApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            bobApp.request('')
            
            done(); 
        });
    });
    
    
    var aliceIdExport
    it('Alice should have expected transports', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.export', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            aliceIdExport = result;
            var export_data = BSON.deserialize(result.data)
            //console.log("Alice meta:", export_meta);
            var transports = export_data['transports'];
            //console.log("transports:", transports);
            //console.log("aliceRelayList:", aliceRelayList);
            
            /* Check that we have the expected transports in Alice's identity export. 
             * Note that they need not be in any particular order, and that transports can have other items than relays too! */
            var cnt = 0;
            var expectedCnt = 2;
            for (i in transports) {
                var transport_ip_port = transports[i].split("wish://")[1];
                if (!transport_ip_port) {
                    break;
                }
                for (j in aliceRelayList) {
                    if (transport_ip_port === aliceRelayList[j].host) {
                        cnt++;
                    }
                }
            }
            if (cnt === expectedCnt) {
                done();
            }
        });
    });
    
    xit('Bob imports Alice\'s identity and transports should exist', function(done) {
        this.timeout(1000);
        console.log("Alice export:", aliceIdExport)
        bobApp.request('identity.import', [aliceIdExport.data], function(err, result) {
            if (err) { done(new Error('Could not import identity.')); }
            
            done(); //FIXME
            
            /*
            bobApp.request('identity.export', [aliceIdentity.uid], function (err, result) {
                if (err) { done(new Error('util.js: Could not export identity.')); }
                console.log("Exported Alice from Bob", result)
            });
            */
        });
    });
    
    /* Remove one of the transports from Alice */
    xit('remove one of transports', function (done) {
        this.timeout(10000);
        aliceApp.request('relay.remove', [ newRelayServer ], function (err, data) {
            if (err) { done(new Error('Could not remove relay.')); }
            setInterval(function () { 
                aliceApp.request('connections.list', [], 
                    function (err, data) {
                        if (err) { done(new Error('connection list error')); }
                        console.log("Connections", data);
                    });
                
            
            }, 6000);
        });
    });
    
    /* Close the connections between Alice and Bob, and wait for reconnect */
    
    /* Check that Bob has updated Alice's transports, that the removed relay server is no longer there */
});