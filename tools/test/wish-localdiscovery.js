var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('Wish Local Discovery', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, ready) {
            if (ready) {
                done();
            } else {
                done(new Error('MistApi not ready, bailing.'));
            }
        });
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
        mist.wish('signals', [], function (err, data) {
            if (err) { return done(new Error('Signals returned error.')); }
            
            if(data[0] && data[0] === 'ok') {
                mist.wish('wld.announce', [], function(err, data) {
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
