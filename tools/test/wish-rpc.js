var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('Wish RPC', function () {
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

    it('should get error on undefined command', function(done) {
        mist.request('this-does-not-exist', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });

    it('should get error on invalid parameters', function(done) {
        mist.wish('identity.export', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });
    
    it('should get version string', function(done) {
        mist.wish('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core version string:", err, data);
            done();
        });
    });
    
    it('should get signals', function(done) {
        var signalsId = mist.wish('signals', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core signals:", err, data, signalsId);
            mist.wishCancel(signalsId);
            done();
        });
    });
    
    it('should get error on full rpc using signals', function(done) {
        //this.timeout(25000);
        
        var signals = [];
        
        for(var i=0; i<60; i++) {
            signals.push(mist.wish('signals', [], function(err, data) { 
                if (err) { console.log("What do we have here?", inspect(data)); return done(); }

                console.log("wish-core signals:", err, data);
                //mist.wishCancel(signalsId);
                //done();
            }));
        }
    });
});
