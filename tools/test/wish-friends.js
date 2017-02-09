var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('MistApi Friends', function () {
    var mist;
    var bob;
    
    before(function (done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, data) {
            done();
        });
    });
    
    after(function(done) {
        console.log("Calling mist.shutdown();");
        mist.shutdown();
        done();
    });

    it('should wait', function(done) {
        setTimeout(done, 1000);
    });

    it('should get bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        bob.request('ready', [], function(err, data) {
            done();
        });
    });

    /*
    it('should wait', function(done) { console.log("Waiting..."); setTimeout(done, 1000); });
    it('should wait', function(done) { console.log("Waiting..."); setTimeout(done, 1000); });
    it('should wait', function(done) { console.log("Waiting..."); setTimeout(done, 1000); });
    it('should wait', function(done) { console.log("Waiting..."); setTimeout(done, 1000); });
    it('should wait', function(done) { console.log("Waiting..."); setTimeout(done, 1000); });
    */

    it('should wet bob', function(done) {
        bob.wish('methods', [], function(err, data) {
            console.log("methods", err, data);
            done();
        });
    });

    it('should wet bob', function(done) {
        bob.wish('identity.list', [], function(err, data) {
            console.log("identity.list", err, data);
            
            if(data.length === 0) {
                bob.wish('identity.create', ['I am Bob'], function(err, data) {
                    done();
                });
            } else {
                done();
            }
        });
    });

    it('should wet bob', function(done) {
        mist.wish('identity.list', [], function(err, data) {
            console.log("alice: identity.list", err, data);
            
            done();
        });
    });

    it('should wait', function(done) {
        console.log("Waiting before shutdown...");
        setTimeout(done, 1000);
    });

    xit('should check identity in core', function (done) {
        console.log("====================Running");
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            
            if (data.length === 0) {
                //console.log("Created identity.");
                mist.wish('identity.create', ['Mr. Andersson'], function(err, data) {
                    console.log("Wish core had no identities. One has been created. Re-run test.");
                    process.exit(1);
                    //done();
                });
            } else {
                done();
            }
        });
    });
    
    xit('should find a identity to befriend using local discovery', function(done) {
        console.log("====================Running 2");
        mist.wish('signals', [], function(err, signal) {
            var args;
            if( Array.isArray(signal) ) { args = signal[1]; signal = signal[0]; }
            
            console.log('wish-core signal:', err, signal);
        });
        
        mist.wish('wld.list', [], function(err, list) {
            if(err) { done(new Error('Error getting list.')); }
            
            for (var i in list) {
                console.log('  * '+list[i].alias);
            }
            done();
        });
    });    
});