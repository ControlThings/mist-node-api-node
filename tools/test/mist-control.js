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
        //mist.shutdown();
        done();
    });

    var peer;
    var end = false;

    it('should find the peer', function(done) {
        function peers(err, data) {
            if (!data[0] || !data[0].online) { console.log('peer[0] -- but not online'); return; }
            
            
            peer = data[0];
            //console.log("The peers is:", peer);
            done();
            done = function() {};
        }
        
        mist.request('signals', [], function(err, signal) { 
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                mist.request('listPeers', [], peers);
            }
        });
        
        mist.request('listPeers', [], peers);
    });
    
    xit('should check identity in core', function (done) {
        console.log('going into second test...');
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            
            console.log("got the identity list", err, data);
            
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
    
    it('shuold test control.model', function(done) {
        console.log("goin into third test,");
        mist.request('mist.control.model', [peer], function (err, model) {
            console.log('mist.control.model', err, data);
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, model);
            done();
        });
    });
    
    var follow;
    
    it('shuold test control.follow', function(done) {
        var end = false;
        follow = mist.request('mist.control.follow', [peer], function (err, data) {
            if (err) { return done(new Error(inspect(data))); }
            //console.log("Follow update:", err, model);
            
            if (!end) { end = true; done(); }
        });
    });
    
    it('shuold test control.read', function(done) {
        mist.request('mist.control.read', [peer, 'counter'], function (err, value) {
            if (err) { return done(new Error(inspect(value))); }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'number') {
                done();
            } else {
                done(new Error('Value not number.'));
            }
        });
    });
    
    it('shuold test control.read', function(done) {
        mist.request('mist.control.read', [peer, 'lon'], function (err, value) {
            if (err) { return done(new Error(inspect(value))); }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'number') {
                done();
            } else {
                done(new Error('Value not number.'));
            }
        });
    });
    
    it('shuold test control.read', function(done) {
        mist.request('mist.control.read', [peer, 'enabled'], function (err, value) {
            if (err) { 
                return done(new Error(inspect(value)));
            }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'boolean') {
                done();
            } else {
                done(new Error('Value not boolean.', typeof value));
            }
        });
    });
    
    it('shuold test control.write', function(done) {
        mist.request('mist.control.write', [peer, 'non-existing'], function (err, data) {
            if (err) { 
                if (data.code === 104) { 
                    return done(); 
                } else {
                    return done(new Error(inspect(data)));
                }
            }
            
            console.log("control.write did not return error as expected:", err, data);
            done(new Error('control.write to non-existing enpoint did not return error.'));
        });
    });
    
    it('shuold test control.write', function(done) {
        mist.request('mist.control.write', [peer, 'counter'], function (err, data) {
            if (err) { 
                if (data.code === 105) { 
                    return done(); 
                } else {
                    return done(new Error(inspect(data)));
                }
            }
            
            console.log("control.write did not return error as expected:", err, data);
            done(new Error('control.write to non-existing enpoint did not return error.'));
        });
    });
    
    it('shuold test control.write', function(done) {
        mist.request('mist.control.write', [peer, 'enabled', 'not-a-bool-value'], function (err, data) {
            if (err) { 
                if (data.code === 105) { 
                    return done(); 
                } else {
                    return done(new Error(inspect(data)));
                }
            }
            
            console.log("control.write did not return error as expected:", err, data);
            done(new Error('control.write to non-existing enpoint did not return error.'));
        });
    });
    
    it('shuold test control.invoke', function(done) {
        mist.request('mist.control.invoke', [peer, 'config', 'a-string'], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            if (typeof data.echo === 'string') {
                done();
            } else {
                done(new Error('Echo not same type', typeof data.echo));
            }
        });
    });
    
    it('shuold test control.invoke', function(done) {
        mist.request('mist.control.invoke', [peer, 'config', { complex: [1, true, "Three"] }], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            if (typeof data.echo === 'object') {
                done();
            } else {
                done(new Error('Echo not same type', typeof data.echo));
            }
        });
    });
});