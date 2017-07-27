var WishApp = require('../../index.js').WishApp;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

var inspect = require('util').inspect;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('Wish Friends', function () {
    var app1;
    var app2;
    var aliceIdentity;
    var aliceAlias = 'Mr. Andersson';
    var bobAlias = 'I am Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before(function (done) {
        app1 = new WishApp({ name: 'AliceFriendManager' });

        app1.on('ready', () => {
            done();
        });
    });

    before('should get bob', function(done) {
        app2 = new WishApp({ name: 'BobsFriendManager', corePort: 9096 });

        app2.on('ready', () => {
            done();
        });
        
        // subscribe to signals from core and automatically accept friend request from Alice
        app2.request('signals', [], function(err, data) {
            if (data[0] && data[0] === 'friendRequest') {
                app2.request('identity.friendRequestList', [], function(err, data) {
                    for (var i in data) {
                        if( Buffer.compare(data[i].luid, bobIdentity.uid) === 0 
                                && Buffer.compare(data[i].ruid, aliceIdentity.uid) === 0 ) 
                        {
                            app2.request('identity.friendRequestAccept', [data[i].luid, data[i].ruid], function(err, data) {
                                console.log("Accepted friend request from Alice:", err, data);
                            });
                            break;
                        }
                    }
                });
            }
        });
    });

    before('should ensure identity', function(done) {
        function createIdentity(alias) {
            app2.request('identity.create', [alias], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                //console.log("Setting Bobs identity to:", data);
                bobIdentity = data;
                done();
            });
        }
        
        app2.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Ensuring identity of Bob.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                app2.request('identity.remove', [data[i].uid], function(err, data) {
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

    before('should ensure identity for Mr. Andersson', function(done) {
        function createIdentity(alias) {
            app1.request('identity.create', [alias], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                //console.log("Setting Alice identity to:", err, data);
                aliceIdentity = data;
                done();
            });
        }
        
        app1.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Ensuring identity of Alice.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                app1.request('identity.remove', [data[i].uid], function(err, data) {
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
    
    it('should find Alice in wld', function(done) {
        this.timeout(35000);
        
        function poll() {
            app1.request('wld.list', [], function(err, data) {
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
    
    it('should add Bob as a friend to Alice', function(done) {
        //console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
        
        /* 
        var signals = mist.wish('signals', [], function(err, data) {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!! A signals message, upon which we cancel wish signals", signals);
            mist.wishCancel(signals);
        });
        */        
        
        app1.request('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Bobs cert", err, data);
            
            setTimeout(function() {
                app1.request('identity.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    //console.log("Alice's identity.list", err,data);
                    done();
                });
            }, 250);
        });
    });

    it('should get bobs identity list', function(done) {
        app2.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            //console.log("Bobs identity.list:", inspect(data, {colors:true}));
            done();
        });
    });

    it('should get Alices identity list', function(done) {
        app1.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            //console.log("Alices identity.list:", inspect(data, {colors:true}));
            done();
        });
    });
    
    it('shuold get a connection between Alice and Bob', function(done) {
        this.timeout(7000);
        
        function poll() {
            app1.request('connections.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                console.log("Alice connections", err, data);
                
                for (var i in data) {
                    if( Buffer.compare(data[i].ruid, bobIdentity.uid) === 0 ) {
                        done();
                        return;
                    }
                }
                
                setTimeout(poll, 1000);
            });
        };
        
        setTimeout(poll, 1000);        
    });
    
    it('should wait for things to settle', function(done) { setTimeout(done,1500); });
});
