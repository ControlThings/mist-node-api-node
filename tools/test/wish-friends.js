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
    var bobAlias = 'I am Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before(function (done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, data) {
            console.log("in ready cb", err, data);
            if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
        });
    });
    
    after(function(done) {
        console.log("Calling mist.shutdown();");
        bob.shutdown();
        mist.shutdown();
        done();
    });

    it('should get bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        bob.request('ready', [], function(err, data) {
            done();
        });
    });

    it('should ensure identity', function(done) {
        function createIdentity(alias) {
            bob.wish('identity.create', [alias], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                bobIdentity = data[0];
                done();
            });
        }
        
        bob.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Ensuring identity of Bob.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                bob.wish('identity.remove', [data[i].uid], function(err, data) {
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

    it('should wet bob', function(done) {
        bob.request('listPeers', [], function(err, data) {
            console.log("bob: listPeers", err, data);
            done();
        });
    });

    it('should get alice identity', function(done) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            aliceIdentity = data[0];
            done();
        });
    });

    it('should export alice identity', function(done) {
        mist.wish('identity.export', [aliceIdentity.uid, 'binary'], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Alice cert", err, BSON.deserialize(data));
            done();
        });
    });

    it('should get bobs identity', function(done) {
        bob.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            bobIdentity = data[0];
            done();
        });
    });

    it('should export bobs identity', function(done) {
        bob.wish('identity.export', [bobIdentity.uid, 'binary'], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bobs cert", err, BSON.deserialize(data));
            done();
        });
    });
    
    it('should find alice in wld', function(done) {
        this.timeout(35000);
        
        function poll() {
            mist.wish('wld.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                console.log("Bobs wld", err, data);
                
                for (var i in data) {
                    if(data[i].alias === 'I am Bob') {
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
    
    it('should delete Bob from Alice if he already exists', function(done) {
        mist.wish('identity.remove', [bobIdentity.uid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bob deleted from Alice", err, data);
            done();
        });
    });
    
    it('should delete Alice from Bob if he already exists', function(done) {
        bob.wish('identity.remove', [aliceIdentity.uid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Alice deleted from Bob", err, data);
            done();
        });
    });
    
    xit('should add Bob as a friend to Alice', function(done) {
        console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
        mist.wish('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bobs cert", err, data);
            
            setTimeout(function() {
                bob.wish('identity.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    console.log("Alice's identity.list", err,data);
                    done();
                });
            }, 250);
        });
    });
    
    xit('shuold get a connection between Alice and Bob', function(done) {
        this.timeout(35000);
        
        function poll() {
            mist.wish('connections.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                console.log("Alice connections", err, data);
                
                for (var i in data) {
                    if(data[i].alias === 'I am Bob') {
                        bobWldEntry = data[i];
                        done();
                        return;
                    }
                }
                
                setTimeout(poll, 1000);
            });
        };
        
        setTimeout(poll, 1000);        
    });
});