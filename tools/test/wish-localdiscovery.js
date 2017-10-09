var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

describe('Wish Local Discovery', function () {
    var mist;
    var name = 'Alice';
    var mistIdentity;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') {
                    util.ensureIdentity(mist, name, function(err, identity) {
                        if (err) { done(new Error('util.js: Could not ensure identity.')); }
                        mistIdentity = identity;
                        done(); 
                    });
                }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    after(function(done) {
        //console.log("Calling mist.shutdown().");
        mist.shutdown();
        //process.nextTick(function() { console.log('exiting.'); process.exit(0); });
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });

    it('should get a localdiscovery signal', function(done) {
        this.timeout(10000);
        mist.wish.request('signals', [], function (err, data) {
            if (err) { return done(new Error('Signals returned error.')); }
            
            if(data[0] && data[0] === 'ok') {
                mist.wish.request('wld.announce', [], function(err, data) {
                    if (err) { if (data.code === 8) { done(new Error('wld.announce does not exist')); } }
                    
                    console.log("Announce returned:", err, data);
                });
            }
            
            if (data[0] && data[0] === 'localDiscovery') {
                done();
                done = function() {};
            }
            
            //done(new Error('Not the expected error.'));
        });
    });
});
