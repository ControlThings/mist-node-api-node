var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('Wish Directory', function () {
    var mist;

    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    done(new Error('MistApi not ready, bailing.'));
                }
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

    xit('should get version string', function(done) {
        this.timeout(5000);
        
        var count = 0;
        mist.wish('directory.find', ['Bob', 2000], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            count++;
            
            if (count === 2000) {
                console.log("All done:", err, data);
                done();
            }
        });
    });
});
