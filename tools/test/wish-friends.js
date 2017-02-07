var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

describe('MistApi Control', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, data) {
            done();
        });
    });
    
    after(function(done) {
        mist.shutdown();
        done();
    });

    it('should check identity in core', function (done) {
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
    
    it('should find a identity to befriend using local discovery', function(done) {
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