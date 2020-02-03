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
var Mist = require('../../index.js').Mist;
var WishApp = require('../../index.js').WishApp;
var Sandboxed = require('../../index.js').Sandboxed;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();
var util = require('./deps/util.js');

var inspect = require('util').inspect;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('MistApi Friends', function () {
    var mist;
    var bob;
    var aliceIdentity;
    var aliceAlias = 'Alice';
    var bobAlias = 'Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before(function (done) {
        mist = new Mist({ name: 'FriendManager', corePort: 9095 });

        setTimeout(function() {
            mist.request('ready', [], function(err, data) {
                if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should get bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        bob.request('ready', [], function(err, data) {
            done();
            
            // subscribe to signals from core and automatically accept friend request from Alice
            bob.wish.request('signals', [], function(err, data) {
                if (data[0] && data[0] === 'friendRequest') {
                    bob.wish.request('identity.friendRequestList', [], function(err, data) {
                        for (var i in data) {
                            if( Buffer.compare(data[i].luid, bobIdentity.uid) === 0 
                                    && Buffer.compare(data[i].ruid, aliceIdentity.uid) === 0 ) 
                            {
                                console.log("declining request.");
                                bob.wish.request('identity.friendRequestDecline', [data[i].luid, data[i].ruid], function(err, data) {
                                    console.log("Declined friend request from Alice:", err, data);
                                });
                                break;
                            }
                        }
                    });
                }
            });
            
        });
    });



    before(function(done) {
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
    
    before(function(done) {
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
    
    before('wait', function(done) { setTimeout(done, 200); })

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            done(); 
        });
    });

    
    
    
    it('should find alice in wld', function(done) {
        this.timeout(35000);
        
        function poll() {
            mist.wish.request('wld.list', [], function(err, data) {
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
    
    it('should be declined friendRequest sent to Bob', function(done) {
        //console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
        mist.wish.request('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bobs cert", err, data);
            
            setTimeout(function() {
                mist.wish.request('identity.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    //console.log("Alice's identity.list", err,data);
                    done();
                });
            }, 250);
        });
    });
});
