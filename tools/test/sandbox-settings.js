var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

describe('MistApi Sandbox', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    console.log('ready', arguments);
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
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    
    var sandboxedGps;
    
    it('shuold test sandbox settings without hint', function(done) {

        var signals = mist.request('signals', [], function(err, data) {
            //console.log("Signal from MistApi", err, data);
            if(data[0] && data[0] === 'sandboxed.settings') {
                done();
                mist.requestCancel(signals);
            }
        });

        sandboxedGps = new Sandboxed(mist, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            sandboxedGps.request('settings', [], function(err, data) {});
        });
    });
    
    it('shuold test sandbox settings with hint', function(done) {

        var hint = 'myCustomHint';

        var signals = mist.request('signals', [], function(err, data) {
            //console.log("Signal from MistApi", err, data);
            if(data[0] && data[0] === 'sandboxed.settings') {
                if (data[1].hint === hint) {
                    //console.log("we're done!");
                    done();
                    mist.requestCancel(signals);
                }
            }
        });

        sandboxedGps = new Sandboxed(mist, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            sandboxedGps.request('settings', [hint], function(err, data) {});
        });
    });
});