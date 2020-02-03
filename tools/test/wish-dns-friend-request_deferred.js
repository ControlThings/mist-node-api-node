/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
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

describe('Wish friend request, transport resolved through DNS', function () {
    var aliceRelayList;
    var newRelayServer = 'wish.cto.fi:40000';
    
    before(function(done) {
        this.timeout(30000) //allow long startup time for the sake of valgrind
        console.log('before 1');
         aliceApp = new WishApp({ name: 'app1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

         aliceApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        this.timeout(30000) //allow long startup time for the sake of valgrind
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
      
    
    
    /** This will remove the existing relay server(s) and put our new relay server instead */
    before(function(done) {
        console.log('before adding relay servers');
        
        aliceApp.request('relay.list', [], (err, data) => {
            if (err) { done(new Error('Could not list relay servers')); }
            
            for (i in data) {
                ((relay) => {
                    aliceApp.request('relay.remove', [relay], function(err, data) {
                        if (err) { done(new Error('Could not list relay servers')); }
                        console.log("Removed relay server", relay);
                    });
                }) (data[i].host);
            }
            
            aliceApp.request('relay.add', [ newRelayServer ], function(err, data) {
                if (err) { done(new Error('Could not add a relay server')); }

                aliceApp.request('relay.list', [], function(err, data) {
                    if (err) { done(new Error('Could not list relay servers')); }
                    console.log('Relays: ', data);  
                    aliceRelayList = data;
                    done();
                });
            
            });
            
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
    
    var bobTransport;
    before(function(done) {
        bobApp.request('relay.list', [], (err, data) => {
            if (err) { done(new Error('Could not relay.list')); }
            bobTransport = data[0].host;
            done();
        });
    });
    
    before(function(done) {
        this.timeout(30000)
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
   
    
    
    it('Alice should have expected transports, identity.get', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.get', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            console.log("Alice: ", result);
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
                console.log('OK, Detected expected number of transports!');
                done();
            }
        });
    });
    
    var aliceIdExport;
    it('Alice identity exported', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.export', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            aliceIdExport = result;
            console.log("Alice: ", result);
            if (aliceIdExport) {
                done();
            }
        });
    });
    
    
    it('Bob friend requests Alice, resolves transport which is FQDN', function(done) {
        this.timeout(100000);
        console.log("Alice export:", aliceIdExport)
        var handled = false;
        //Start listening for friend request signals on Alice
        var id = aliceApp.request('signals', [], function(err, data) {
           if (err) { done(new Error('Could not setup signals')); }
           console.log('Alice signal:', data);
           
           if (data[0] === 'friendRequest') {
                
                aliceApp.request('connections.disconnectAll', [], function (err, data) {
                    if (err) { 
                        done (new Error("error when disconnecting all"));
                    }
                    setTimeout(() => {
                        aliceApp.request('identity.friendRequestAccept', [aliceIdentity.uid, bobIdentity.uid], function (err, data) {
                            if (err) { 
                                //console.log('identity.friendRequestAccept err', data);
                                if (!handled) { done(new Error('Could not identity.friendRequestAccept', data)); } 
                                return;
                            }
                            console.log("Accepting friend req");
                            aliceApp.cancel(id);
                            handled = true;
                            aliceApp.request('identity.update', [bobIdentity.uid, { connect: false }], function (err, data) {
                                if (err) { done(new Error('Error when Alice setting connect:false to Bob')); }
                                done();
                            });
                        });
                    }, 5000);
                });
               
           }
        });
        
        bobApp.request("identity.friendRequest", [bobIdentity.uid, aliceIdExport], function (err, data) {
            if (err) { done(new Error('Could not identity.friendRequest.', data)); }
        });
        
    });
    
    it('Alice should see expected transports to Bob', function(done) {
        this.timeout(1000);
        aliceApp.request('identity.get', [bobIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            var hosts = result['hosts'];
            var transports = hosts[0]['transports'];
            console.log("Bob's transports: ", transports);
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
                    if (transport_ip_port === bobTransport) {
                        cnt++;
                    }
                }
            }
            if (cnt === expectedCnt) {
                console.log('OK, Detected expected transport to Bob!');
                done();
            }
        });
    });
    
    it('Bob should see expected transports to Alice', function(done) {
        this.timeout(1000);
        bobApp.request('identity.get', [aliceIdentity.uid], function(err, result) {
            if (err) { done(new Error('util.js: Could not export identity.')); }
            var hosts = result['hosts'];
            var transports = hosts[0]['transports'];
            console.log("Alice's transports: ", transports);
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
                    if (transport_ip_port === aliceRelayList[0].host) {
                        cnt++;
                    }
                }
            }
            if (cnt === expectedCnt) {
                console.log('OK, Detected expected transport to Alice!');
                done();
            }
        });
    });
    
    it('Wait for Bob to connect to Alice', function(done) {
        this.timeout(30000);
        bobApp.request('connections.checkConnections', [], (err, data) => {
            if (err) { done(new Error('Error when connections.checkConnections')) }
            setTimeout(function(){ done(); },2000);
        });
    });
    
    it('Bob should have connected to Alice', function(done) {
        bobApp.request('connections.list', [], (err, data) => {
            if (err) { done(new Error('Error when connections.list')) }
            
            //console.log('connections', data);
            
            if (data[0].ruid.compare(aliceIdentity.uid) == 0) {
                if (data[0].outgoing && data[0].relay === false) {
                    done();
                }
            }
        });
    });
    
});