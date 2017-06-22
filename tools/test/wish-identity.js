var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('MistApi Identity', function () {
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

    it('should get error on identity not found', function(done) {
        mist.wish('identity.get', [new Buffer('deadbeefabababababababababababababababababababababababababababab', 'hex')], function (err, data) {
            if(err) { if (data.code === 997) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });

    it('should get identity data', function(done) {
        mist.wish('identity.create', ['Leif Eriksson'], function(err, data) {
            var uid = data.uid;
            mist.wish('identity.get', [uid], function (err, data) {
                if(err) { if (data.code === 997) { return done(); } }

                mist.wish('identity.remove', [data.uid], function (err, data) {
                    if(err) { if (data.code === 997) { return done(); } }

                    done();
                });
            });
        });
    });
});