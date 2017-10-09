var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

var inspect = require('util').inspect;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('MistApi Friends', function () {
    var mist;
    var bob;
    var aliceIdentity;
    var aliceAlias = 'Mr. Andersson';
    var bobAlias = 'I am Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before(function (done) {
        mist = new Mist({ name: 'FriendManager', corePort: 9095 });

        setTimeout(function() {
            mist.request('ready', [], function(err, data) {
                console.log("in ready cb", err, data);
                if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should get bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        bob.request('ready', [], function(err, data) {
            done();
        });
        
        
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

    it('should ensure identity', function(done) {
        function createIdentity(alias) {
            bob.wish.request('identity.create', [alias], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                //console.log("Setting Bobs identity to:", data);
                bobIdentity = data;
                done();
            });
        }
        
        bob.wish.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Ensuring identity of Bob.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                bob.wish.request('identity.remove', [data[i].uid], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    c--;
                    
                    if ( c===0 ) {
                        console.log("Deleted ", t, 'identities. Now creating Bob');
                        createIdentity(bobAlias, done);
                    }
                });
            }
            
            if(t===0) {
                createIdentity(bobAlias, done);
            }
        });
    });

    it('should ensure identity for Mr. Andersson', function(done) {
        function createIdentity(alias) {
            mist.wish.request('identity.create', [alias], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                //console.log("Setting Alice identity to:", err, data);
                aliceIdentity = data;
                done();
            });
        }
        
        mist.wish.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Ensuring identity of Alice.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                mist.wish.request('identity.remove', [data[i].uid], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    c--;
                    
                    if ( c===0 ) {
                        console.log("Deleted ", t, 'identities. Now creating Alice (Mr. Andersson)');
                        createIdentity(aliceAlias, done);
                    }
                });
            }
            
            if(t===0) {
                createIdentity(aliceAlias, done);
            }
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
