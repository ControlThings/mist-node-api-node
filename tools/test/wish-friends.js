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
    
    before('Should attach signals to app1', function(done) {
        app1.request('signals', [], function(err, data) {
            console.log("App1: Got signal", data);
        });
        
        done();
    });

    before('should get bob', function(done) {
        app2 = new WishApp({ name: 'BobsFriendManager', corePort: 9096 });

        app2.on('ready', () => {
            done();
        });
       
    });
    
    before('Should attach signals to app2', function(done) {
        // subscribe to signals from core and automatically accept friend request from Alice
        app2.request('signals', [], function(err, data) {
            console.log("App2: Got signal", data);
            if (data[0] && data[0] === 'friendRequest') {
                console.log("Friend request signal");
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
        done();
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
        console.log("Friend request params:", [identity1.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
        
        /* 
        var signals = mist.wish('signals', [], function(err, data) {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!! A signals message, upon which we cancel wish signals", signals);
            mist.wishCancel(signals);
        });
        */        
        
        app1.request('wld.friendRequest', [identity1.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bobs cert", err, data);
            
            setTimeout(function() {
                app1.request('identity.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    console.log("Alice's identity.list after wld.friendRequest", err,data);
                    done();
                });
            }, 250);
        });
    });

    it('should get bobs identity list', function(done) {
        app2.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            console.log("Bobs identity.list:", inspect(data, {colors:true}));
            done();
        });
    });

    it('should get Alices identity list', function(done) {
        app1.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            console.log("Alices identity.list:", inspect(data, {colors:true}));
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
    
    it('Verify that Alice has a transport for Bob that seems valid', function(done) {
        console.log("Bob's uid", identity2);
        app1.request('identity.get', [identity2.uid], function(err, data) {
            if (err) { return done(new Error("Error while doing identity.get from Alice " + err + " " + inspect(data))); }
            
            console.log("Bob's identity on Alice", data);
            for (var i in data.hosts) {
                var o = data.hosts[i];
                if (Array.isArray(o.transports)) {
                    //console.log("transports:", o.transports);
                    
                    /* Test success criterion: There must be at least one transport, and it must be string starting with: wish */
                    var url = o.transports[0];
                    
                    if (typeof(url) === "string") {
                        if (url.startsWith("wish")) {
                            done();
                            return;
                        }
                        else {
                            console.log("url is", url);
                            return done(new Error("Transport url is malformed in identity.get(Bob.uid) from Alice, does not start with 'wish': " + url));
                        }
                    } else {
                        return done(new Error("Transport url is not string in identity.get(Bob.uid) from Alice"));
                    }
                    
                    
                } else {
                    return done(new Error("There is no transports array in identity.get(Bob.uid) from Alice"));
                }
            }
            
            
            
        })
    })
});
