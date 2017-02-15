var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('signals', [], function(err, data) {
            if(data === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
        });
    });
    
    after(function(done) {
        process.nextTick(function() { mist.shutdown(); });
        done();
    });

    it('should get veersion string', function(done) {
        
        mist.request('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("mist-api version string:", err, data);
            done();
        });
    });
});