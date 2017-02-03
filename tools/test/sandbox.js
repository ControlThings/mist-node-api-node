var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

describe('MistApiSandbox', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, data) {
            done();
        });
    });
    
    it('should be just fine', function (done) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            
            if (data.length === 0) {
                mist.wish('identity.create', ['Mr. Andersson'], function(err, data) {
                    done();
                });
            } else {
                done();
            }
        });
    });
    
    it('should shutdown gracefully', function(done) {
        mist.shutdown();
        done();
    });
    
});