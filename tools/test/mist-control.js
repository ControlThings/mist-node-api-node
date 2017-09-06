var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    var mistIdentity;
    var name = 'Mr. Andersson';
    
    before(function (done) {
        // TODO fix this workaround which stops done being called several times ocationally...
        var done2 = function() { done(); done = function() {}; };
        
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data === 'ready') {
                    util.clear(mist, function(err) {
                        if (err) { done2(new Error('util.js: Could not clear core.')); }
                        
                        util.ensureIdentity(mist, name, function(err, identity) {
                            if (err) { done2(new Error('util.js: Could not ensure identity.')); }
                            
                            mistIdentity = identity;
                            done2(); 
                        });
                    });
                }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });
    
    var peer;
    var end = false;
    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings' }); // , coreIp: '127.0.0.1', corePort: 9094
        
        node.create({
            enabled: { label: 'Enabled', type: 'bool', read: true, write: true },
            lon: { label: 'Longitude', type: 'float', read: true },
            counter: { label: 'Counter', type: 'int', read: true, write: true },
            name: { label: 'Name', type: 'string', read: true, write: true },
            config: { label: 'Config', type: 'invoke', invoke: true }
        });
        
        node.invoke('config', function(args, cb) {
            cb({ cool: ['a', 7, true], echo: args });
        });
        
        node.write(function(epid, data) {
            //console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 200);
    });  

    before('should find the peer', function(done) {
        function peers(err, data) {
            //console.log('==========================', data, mistIdentity);
            for(var i in data) {
                if ( Buffer.compare(data[i].luid, mistIdentity.uid) === 0 
                        && Buffer.compare(data[i].ruid, mistIdentity.uid) === 0 ) 
                {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); return; }

                    peer = data[0];
                    //console.log("The peers is:", peer);
                    done();
                    done = function() {};
                    
                    break;
                }
            }
        }
        
        mist.request('signals', [], function(err, signal) { 
            //console.log('signal:', err, signal);
            
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
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model:", err, model);
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
    
    it('shuold test control.write', function(done) {
        mist.request('mist.control.write', [peer, 'enabled', false], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }
            
            //console.log("mist.control.write:", err, data);
            done();
        });
    });
    
    var string = 'A balloon, celebrating arrays of characters.';
    
    it('shuold test control.write(value: string)', function(done) {
        mist.request('mist.control.write', [peer, 'name', string], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }
            
            console.log("mist.control.write(name: string):", err, data);
            done();
        });
    });
    
    it('shuold test control.read string', function(done) {
        mist.request('mist.control.read', [peer, 'name'], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }
            
            if (data !== string) { return done(new Error('Read did not return the string written in previous test.')); }
            
            console.log("mist.control.read(name: string):", err, data);
            done();
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
    
    it('shuold test control.invoke with no value argument', function(done) {
        mist.request('mist.control.invoke', [peer, 'config'], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            //console.log('control.invoke with no value argument returned ', err, data);
            done();
            
        });
    });
});