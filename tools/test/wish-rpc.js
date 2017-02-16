var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('MistApi RPC', function () {
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

    it('should get error on undefined command', function(done) {
        mist.request('this-does-not-exist', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error.'));
        });
    });
    
    it('should get version string', function(done) {
        mist.wish('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core version string:", err, data);
            done();
        });
    });
});
