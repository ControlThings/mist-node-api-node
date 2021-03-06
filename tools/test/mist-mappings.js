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

var srcApp;
var dstApp;
var requestorApp;

var aliceIdentity;
var bobIdentity;
var charlieIdentity;

var bobWldEntry;
var charlieWldEntry;

/*
 * Test for mappings between three cores. 
 * 
 * This test expects the test suite to have three cores, at app ports at 9095, 9096 and 9097.
 * 
 * The test ensures identities Alice, Bob, Charlie. Alice is making the requestMapping, Bob is the source of the mapping and Charlie is the destination.
 * 
 * @returns {undefined}
 */

describe('Mist Mappings', function () {
    var srcMist;
    var dstMist;
    var requestorMist;

    before(function(done) {
        //console.log('before 1');
        requestorApp = new WishApp({ name: 'control app', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
   
    before(function(done) {
        //console.log('before 2');
        srcApp = new WishApp({ name: 'app1', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        srcApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        //console.log('before 3');
        dstApp = new WishApp({ name: 'app2', protocols: ['test'], corePort: 9097 }); // , protocols: [] });

        dstApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        util.clear(requestorApp, done);
    });
    
    before(function(done) {
        util.clear(srcApp, done);
    });
    
    before(function(done) {
        util.clear(dstApp, done);
    });

    var name1 = 'Alice'; // Alice is the one who requests the mapping
    
    before(function(done) {
        util.ensureIdentity(requestorApp, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob'; // Bob is the source for the mapping
    
    before(function(done) {
        util.ensureIdentity(srcApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            done(); 
        });
    });
    
    var name3 = 'Charlie'; //Charlie is destination for the mapping
    before(function(done) {
        util.ensureIdentity(dstApp, name3, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            charlieIdentity = identity;
            done(); 
        });
    });
    
    before(function(done) {
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
    
    
    before(function (done) {
        requestorMist = new Mist({ name: 'Requestor Mist', coreIp: '127.0.0.1', corePort: 9095 });

        setTimeout(function() {
            requestorMist.request('ready', [], function(err, ready) {
                if (ready) {
                    //console.log("==============================requestorMist ready")
                    
                    requestorMist.request('signals', [], function(err, data) {
                        if (err) { console.log("err: ", err); return; }
                        //console.log("requestorMist signal: ", data);
                    });
                    done();
                } else {
                    //console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }
               
            });
        }, 200);
    });

    var source;
    var destination;

    var outputValue = 7;
    
    before(function(done) {
        
        source = new MistNode({ name: 'src Node', coreIp: '127.0.0.1', corePort: 9097 });
        
        source.addEndpoint('mist', { type: 'string' });
        source.addEndpoint('mist.name', { label: 'Name', type: 'string', read: function(args, peer, cb) { cb(null, 'Output Node'); } });
        source.addEndpoint('output', {
            label: 'Output',
            type: 'int',
            read: function(args, peer, cb) {
                //console.log('reading output', outputValue);
                cb(null, outputValue);
            }
        });
        
        source.changed('output');
        
        source.addEndpoint('test', { label: 'test', type: 'string', read: true, write: true });

        setInterval(function() { outputValue++; source.changed('output'); }, 1000);
        
        setTimeout(done, 100);
    });
    
    before(function(done) {
        var inputValue = 7;
        destination = new MistNode({ name: 'dst Node', coreIp: '127.0.0.1', corePort: 9096 });
        
        destination.addEndpoint('mist', { type: 'string' });
        destination.addEndpoint('mist.name', { label: 'Name', type: 'string', read: function(args, peer, cb) { cb(null, 'Input Node'); } });
        destination.addEndpoint('input', {
            label: 'Input',
            type: 'int',
            read: function(args, peer, cb) {
                cb(null, inputValue);
            },
            write: function(value, peer, cb) {
                inputValue = value;
                cb();
                destination.changed('input');
            }
        });
        
        setTimeout(done, 100);
        
    });
   
    before('listen to signals on source', function(done) {
        source.wish.request('signals', [], function(err, data) {
            console.log('source: signals:', err, data);
        });
        done();
    });
   
    before('Alice should find Bob in wld', function(done) {
        this.timeout(35000);
        
     
        
        function poll() {
            requestorApp.request('wld.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                //console.log("Bobs wld", err, data);
                
                for (var i in data) {
                    if ( Buffer.compare(data[i].ruid, bobIdentity.uid) === 0) {
                        bobWldEntry = data[i];
                        done();
                        return;
                    }
                }
                
                setTimeout(poll, 1000);
            });
        };
        
        setTimeout(poll, 100);
    });
    
    before('should add Bob as a friend to Alice', function(done) {
        //console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
            
        requestorApp.request('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            setTimeout(done,1000);
        });
    });
  
    before('Bob should accept friend request from Alice and switch should become visible', function(done) {
        this.timeout(10000);
        
        var signals = requestorMist.request('signals', [], function(err, data) {
            if (data === 'peers' || data[0] === 'peers') {
                //console.log("Requestor Mist peers")
               
                if (signals != 0) {
                    requestorMist.requestCancel(signals);
                    signals = 0;
                }
               
                requestorMist.request('wish.identity.list', [], function (err, data) {
                    if (err) { return; }
                    console.log("mistapi: wish.identity.list ", data);
                });
                
                done();
                done = function() { };
            }
        });
        
        srcApp.request('identity.friendRequestList', [], function(err, data) {
            //console.log('srcApp friendRequestList:', err, data);
            
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list!'));
            }

            srcApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                //console.log('srcApp friendRequestAccept:', err, data);
            });
        });        
    });
    
    before('Alice should find Charlie in wld', function(done) {
        this.timeout(35000);
        
     
        
        function poll() {
            requestorApp.request('wld.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                //console.log("Bobs wld", err, data);
                
                for (var i in data) {
                    if ( Buffer.compare(data[i].ruid, charlieIdentity.uid) === 0) {
                        charlieWldEntry = data[i];
                        done();
                        return;
                    }
                }
                
                setTimeout(poll, 1000);
            });
        };
        
        setTimeout(poll, 100);
    });
    
    before('should add Charlie as a friend to Alice', function(done) {
        //console.log("Friend request params:", [aliceIdentity.uid, charlieWldEntry.ruid, charlieWldEntry.rhid]);
            
        requestorApp.request('wld.friendRequest', [aliceIdentity.uid, charlieWldEntry.ruid, charlieWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
          
            setTimeout(done,1000);
        });
    });
    
    
  
    before('Charlie should accept friend request from Alice and switch should become visible', function(done) {
        this.timeout(10000);
        var signals = requestorMist.request('signals', [], function(err, data) {
            if (data === 'peers' || data[0] === 'peers') {
               //console.log("Requestor Mist peers")
               
               if (signals != 0) {
                    requestorMist.requestCancel(signals);
                    signals = 0;
                }
               
               
                
                done();
                done = function () { }
               
            }
        });
        
        

        
        dstApp.request('identity.friendRequestList', [], function(err, data) {
            //console.log('dstApp friendRequestList:', err, data);
            
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list!'));
            }

            dstApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                //console.log('dstApp friendRequestAccept:', err, data);
            });
        });        
    });
    
    
    before('Peer ruids in listPeers should be in MistApi wish.identity.list', function (done)  {
        /* This demonstrates the problem. MistApi's identity list is not in sync, we should have there also the other currently online (ucp) peers. */
        requestorMist.request('wish.identity.list', [], function (err, mistApiWishIdentityList) {
             if (err) { return; }
             console.log("mistapi: wish.identity.list ", mistApiWishIdentityList);
             
             requestorMist.request('listPeers', [], function (err, listOfPeers) {
                 if (err) { return; }
                 var found = false;
                 for (var i in listOfPeers) {
                     var peerUid = listOfPeers[i].ruid;
                     for (var j in mistApiWishIdentityList) {
                         if (Buffer.compare(peerUid, mistApiWishIdentityList[j].uid) === 0) {
                             found = true;
                             break;
                         }
                     }
                 }
                 if (!found) {
                     done(new Error('listPeers has identities which are not in MistApi\'s wish.identity.list'))
                 }
                 else {
                     done();
                 }
             });
            
         });
    });
    
    var srcPeer;
    var dstPeer;
    
    before('Get Mist peers', function(done) {
        function filterPeers(err, data) {
            if (err) { console.log("err", err); return;}
            for (var i in data) {
                //console.log("listPeers:",i, data[i]);
                
                if (Buffer.compare(data[i].ruid, bobIdentity.uid) === 0) {
                    srcPeer = data[i];
                }
                if (Buffer.compare(data[i].ruid, charlieIdentity.uid) === 0) {
                    dstPeer = data[i];
                }
                
            }
            
            done();
        }
        
        requestorMist.request('listPeers', [], filterPeers)
    });
    
    
    before('checking model srcPeer', function(done) {
        requestorMist.request('mist.control.model', [srcPeer], function(err, data) {
            //console.log('Model check:', err, data);
            done();
        });
    });
    
    before('checking model dstPeer', function(done) {
        requestorMist.request('mist.control.model', [dstPeer], function(err, data) {
            //console.log('Model check:', err, data);
            done();
        });
    });
    
    
    it('should request mapping (1)', function(done) {
        
        console.log('Begin request mapping test ===========================================');
        
        requestorMist.request('listPeers', [], (err, data) => {
            console.log("listPeers", data);
        });
        
        requestorMist.request('wish.identity.list', [], (err, data) => {
            console.log("mist.wish.identity.list", data);
        });
        
        
        setTimeout(() => { done(); done = () => {}; }, 500);
        
        //this.timeout(10000);
        requestorMist.request("mist.control.requestMapping", [ srcPeer, dstPeer, 'output', {}, 'input', {} ], function(err, data) {
            if (err) {
                done();
                done = function() { }
                console.log("requestMapping err", err);
                return;
            }
            
            done(new Error("Unexpectedly not an error. "+inspect(data)));
            console.log("requestMapping: ", data);
        });
    });


    it('should wait for connection between coerced nodes', function(done) {
        this.timeout(10000);

        var timeout = setTimeout(() => { done(); }, 9000);

        var signals = source.wish.request('signals', [], function(err, data) {
            if (data[0] === 'connections') {
                source.wish.request('connections.list', [], function(err, data) {
                    if (err) { return done(new Error('Failed listing connections')); }
                    
                    for(var i in data) {
                        if ( Buffer.compare(data[i].luid, charlieIdentity.uid) === 0 
                              && Buffer.compare(data[i].ruid, bobIdentity.uid) === 0 ) 
                        {
                            clearTimeout(timeout);
                            source.wish.cancel(signals);
                            done();
                            done = () => {};
                            return;
                        }
                    }
                });        
            }
        });
    });
    
    var mappingId;
    it('should request mapping (2nd time)', function(done) {
        //this.timeout(10000);
        requestorMist.request("mist.control.requestMapping", [ srcPeer, dstPeer, 'output', {}, 'input', {} ], function(err, data) {
            if (err) {
                console.log("dstPeer", dstPeer, "srcPeer", srcPeer)
                done(new Error("requestMapping2 error: " + inspect(data)));
                return;
            }
            
            if (typeof data !== 'string') {
                return done(new Error('Requested mapping got faulty id. Expected string, got', typeof data));
            }
            mappingId = data;
            
            console.log("requestMapping2: ", data);
            done();
        });
    });

    
    it('should see the destination value change', function(done) {
        //this.timeout(10000);
        var id = requestorMist.request("mist.control.follow", [dstPeer], function(err, data) {
            if (err) {
                console.log("requestMapping2 err", err);
                return;
            }
            
            if (data.id !== 'output') { return; }
            
            if (data.data !== outputValue) { return done(new Error('The mapping reported unexpected data: '+ data.data +' while expecting: '+ outputValue)); }
            //requestorMist.requestCancel(id);
            //console.log("follow data:", data)
            
            done();
            done = function() { };
        });
    });

    it('should see the mapping in model', function(done) {
        requestorMist.request("mist.control.model", [dstPeer], function (err, data) {
            if (err) { console.log("control.model err", err); return; }
            
            //console.log(inspect(data, false, null));
            //console.log("mappingid", data['output']['mappings']);
            if (typeof data['output']['mappings'][mappingId] !== 'undefined') {
                done();
            }
        });
    });
    
/*
    
    it('should delete the mapping', function (done) {
        this.timeout(10000);
        setTimeout(function() {
            requestorMist.request("mist.control.unMap", [dstPeer, mappingId], function (err, data) {
            if (err) {
                console.log("unMap err", err);
                return;
            }
            console.log("unMap data", data);
            done();
        }, 5000);
        });
    });
*/
    
});