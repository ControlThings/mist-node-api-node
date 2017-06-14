var Mist = require('../../index.js').Mist;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

describe('MistApi Friends', function () {
    var mist;
    var bob;
    var aliceIdentity;
    var aliceAlias = 'Alice';
    var bobAlias = 'Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before(function (done) {
        mist = new Mist({ name: 'AliceFriendManager', type: 4, coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            var expired = false;
            mist.wish('signals', [], function(err, data) {
                if (expired) { return; } else { expired = true; }
                console.log("in ready cb", err, data);
                if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });
    
    after(function(done) {
        console.log("Calling mist.shutdown();");
        //bob.shutdown();
        mist.shutdown();
        done();
    });

    it('should do a wish request', function(done) {
        mist.wish('identity.list', [], function(err, data) {
            console.log('Identity list:', err, data);
            if (!err && data.length === 0) {
                mist.wish('identity.create', [aliceAlias], done);
                done();
            } else {
                done();
            }
        });
    });

    it('should get bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', type: 4, coreIp: '127.0.0.1', corePort: 9096 });

        setTimeout(function() {
            var expired = false;
            bob.wish('signals', [], function(err, data) {
                if (expired) { return; } else { expired = true; }
                console.log("in ready cb", err, data);
                if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("bob's services", err, data);
            done();
        });
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("bob's services", err, data);
            done();
        });
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("bob's services", err, data);
            done();
        });
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("bob's services", err, data);
            done();
        });
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("alice's services", err, data);
            done();
        });
    });

    it('should list services', function(done) {
        mist.wish('services.list', [], function(err, data) {
            console.log("alice's services", err, data);
            done();
        });
    });

    it('should wait for things to settle', function(done) { setTimeout(done,1500); });
});
