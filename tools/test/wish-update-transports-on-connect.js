var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var name1 = 'Alice';
var name2 = 'Bob';

var aliceApp;
var bobApp;

var aliceIdentity;
var bobIdentity;

var bobWldEntry;

/*
 * Test that transports are correctly encoded in friend requests, and verify that transports are updated when new connections are made
 * 
 * This test expects the test suite to have two cores, at app ports at 9095, 9096.
 * 
 * Test test first adds a couple of relay servers. The test ensures identities Alice and Bob. 
 * 
 * @returns {undefined}
 */

describe('Wish core multiple transports, friend requests, update transports', function () {
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

    
    
    before(function(done) {
        util.ensureIdentity(aliceApp, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    
    
    before(function(done) {
        util.ensureIdentity( bobApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            
            done(); 
        });
    });
    
    before(function(done) {
        this.timeout(30000)
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
   
    
    var aliceIdExport
    it('Alice should have expected transports, identity.get', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.get', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            //console.log("Alice: ", result);
            var hosts = result['hosts'];
            var transports = hosts[0]['transports'];
            //console.log("Alice's transports ", transports);
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
                console.log('OK, Detected expected number of transports!');
                done();
            }
        });
    });
    
    it('Bob friend requests alice and should see correct transports', function(done) {
        this.timeout(1000);
        console.log("Alice export:", aliceIdExport)
        
        /* Start listening for friend request signals on Alice */
        var id = aliceApp.request('signals', [], function(err, data) {
           if (err) { done(new Error('Could not setup signals')); }
           console.log('Alice signal:', data);
           
           if (data[0] === 'friendRequest') {
               aliceApp.request('identity.friendRequestAccept', [aliceIdentity.uid, bobIdentity.uid], function (err, data) {
                   if (err) { done(new Error('Could not wld.friend requests accept.')); }
                   console.log("Accepting friend req");
                   aliceApp.cancel(id);
                   done();
               });
               
           }
        });
        
        bobApp.request('wld.list', [], function(err, result) {
            if (err) { done(new Error('Could not wld.list.')); }
            
            for (item in result) {
                //console.log("Discovery:", result[item]['ruid'], aliceIdentity.uid);

                if (Buffer.compare(result[item]['ruid'], aliceIdentity.uid) === 0) {
                    bobApp.request("wld.friendRequest", [bobIdentity.uid, result[item]['ruid'], result[item]['rhid']], function (err, data) {
                        if (err) { done(new Error('Could not wld.friendRequest.')); }
                    });
                    
                }
            }

        });
    });
    
    /* Check that Bob sees Alice's expected transports */
    it('Check that Bob sees Alice\'s expected transports', function (done) {
        //this.timeout(10000);
        bobApp.request('identity.get', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            //console.log("Alice: ", result);
            var hosts = result['hosts'];
            var transports = hosts[0]['transports'];
            //console.log("Alice's transports ", transports);
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
                console.log('OK, Detected expected number of transports of Alice on Bob core!');
                done();
            }
        });
    });
    
    /* Close the connections between Alice and Bob, and wait for reconnect */
    
    it('Remove one relay server from Alice and close connections between Alice and Bob', function (done) {
        this.timeout(20000);
        
        /* Remove one relay server from Alice */
        aliceApp.request('relay.remove', [newRelayServer], function(err, data) {
                                if (err) { done(new Error('Could not relay.remove', err)); }
                                
                            });
        setTimeout(function () { 
            bobApp.request('connections.list', [], function (err, data) {
                if (err) { done(new Error('Could not connections.list')); }
                console.log('connections.list', data);
                for (c in data) {
                    if (Buffer.compare(data[c].ruid, aliceIdentity.uid) === 0) {
                        console.log('Found connection');
                        var cid = data[c].cid;
                        bobApp.request('connections.disconnect', [cid], function (err, data) {
                            if (err) { done(new Error('Could not connections.close', err)); }
                            console.log('Closing connection:', cid);
                            
                        });
                       
                    }
                }
                done();
            });
        }, 5000);
    });
    
    it('Wait connection between Alice and Bob, verify that transports are updated at reconnect ie. Bob can see that Alice no longer has the extra relay server', function (done) {
        this.timeout(20000);
        setTimeout(function () { 
            bobApp.request('connections.list', [], function (err, data) {
                if (err) { done(new Error('Could not connections.list')); }
                console.log('connections.list', data);
                for (c in data) {
                    if (Buffer.compare(data[c].ruid, aliceIdentity.uid) === 0) {
                        console.log('Found connection again');
                        
                        bobApp.request('identity.get', [aliceIdentity.uid], function(err, result) {
                            if (err) { done(new Error('util.js: Could not export identity.')); }
                            //console.log("Alice: ", result);
                            var hosts = result['hosts'];
                            var transports = hosts[0]['transports'];
                            //console.log("Alice's transports ", transports);
                            /* Check that we have the expected transports in Alice's identity export. 
                             * Note that they need not be in any particular order, and that transports can have other items than relays too! */
                            var cnt = 0;
                            var expectedCnt = 1;
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
                                console.log('OK, Detected expected number of transports of Alice on Bob core!');
                                done();
                            }
                        });
                        
                    }
                }
            });
        }, 10000);
    });
          
    /* Check that Bob has updated Alice's transports, that the removed relay server is no longer there */
});