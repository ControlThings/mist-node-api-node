var WishApp = require('../../index.js').WishApp;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

var inspect = require('util').inspect;
var util = require('./deps/util.js');

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('Wish Friends', function () {
    var app1;
    var app2;
    var identity1;
    var alias1 = 'Alice';
    var alias2 = 'Bob';
    var identity2;
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
                        if( Buffer.compare(data[i].luid, identity2.uid) === 0 
                                && Buffer.compare(data[i].ruid, identity1.uid) === 0 ) 
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

    before('should ensure identity1 app1', function(done) {
        
        util.clear(app1, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }

            util.ensureIdentity(app1, alias1, function(err, identity) {
                if (err) { done(new Error('util.js: Could not ensure identity.')); }

                identity1 = identity;
                done(); 
            });
        });
    });
    
    before('should ensure identity2 app2', function(done) {
        util.clear(app2, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }

            util.ensureIdentity(app2, alias2, function(err, identity) {
                if (err) { done(new Error('util.js: Could not ensure identity.')); }

                identity2 = identity;
                done(); 
            });
        });
        
    });
    
    it('should find Alice in wld', function(done) {
        this.timeout(35000);
        
        function poll() {
            app1.request('wld.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                //console.log("Bobs wld", err, data);
                
                for (var i in data) {
                    if ( Buffer.compare(data[i].ruid, identity2.uid) === 0) {
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
        
        app1.request('wld.friendRequest', [identity1.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
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
                    if( Buffer.compare(data[i].ruid, identity2.uid) === 0 ) {
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
