var Mist = require('../../index.js').Mist;
//var Sandboxed = require('../../index.js').Sandboxed;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('MistApi Friends', function () {
    var mist;
    var bob;
    
    it('should start alice', function(done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                console.log("in ready cb", err, data);
                if(data === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should start bob', function(done) {
        bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        setTimeout(function() {
            bob.request('signals', [], function(err, data) {
                console.log("bob ready cb", err, data);
                if(data === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should start bob', function(done) {
        console.log("getting bobs identity list");
        bob.wish('identity.list', [], function(err, data) {
            console.log("bob identity.list cb", err, data);
            done();
        });
    });

    it('should start bob', function(done) {
        process.nextTick(function() { bob.shutdown(); });
        process.nextTick(function() { mist.shutdown(); });
        done();
    });
});