var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    var mistIdentity;
    var app1;

    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });

    before(function(done) {
        util.clear(app1, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity = identity;
            done(); 
        });
    });
    
    before('start a mist api', function(done) {
        mist = new Mist({ name: 'MistApi', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        setTimeout(done, 200);
    });  
    
    var peer;
    var end = false;
    var node;
    var enabled = true;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.addEndpoint('mist', { type: 'string' });
        node.addEndpoint('mist.name', { label: 'Name', type: 'string', read: true, write: true });
        node.addEndpoint('name', { label: 'Name', type: 'string', read: true, write: true });
        node.addEndpoint('enabled', { label: 'Enabled', type: 'bool', read: true, write: true });
        node.addEndpoint('lon', { label: 'Longitude', type: 'float', read: true });
        node.addEndpoint('counter', { label: 'Counter', type: 'int', read: true, write: true });
        node.addEndpoint('device', { type: 'string' });
        node.addEndpoint('device.config', { label: 'Config', invoke: true });
        node.addEndpoint('readProblem', { label: 'Problem', type: 'string', read: function(args, peer, cb) { cb({ code: 6, msg: 'Read says no.' }); } });
        node.addEndpoint('writeProblem', { label: 'Problem', type: 'string', write: function(args, peer, cb) { cb({ code: 6, msg: 'Write says no.' }); } });
        node.addEndpoint('invokeProblem', { label: 'Problem', invoke: function(args, peer, cb) { cb({ code: 6, msg: 'Invoke says no.' }); } });
        node.addEndpoint('temporary', { label: 'Removable', type: 'int', read: true, write: true });
        node.removeEndpoint('temporary');

        var name = 'Just a Name';
        
        node.read('mist.name', function(args, peer, cb) { cb(null, name); });
        
        node.read('name', function(args, peer, cb) { cb(null, 'root:'+ name); });
        
        node.read('enabled', function(args, peer, cb) { cb(null, enabled); });
        
        node.read('lon', function(args, peer, cb) { cb(null, 63.4); });
        
        node.read('counter', function(args, peer, cb) { cb(null, 56784); });
        
        node.invoke('device.config', function(args, peer, cb) {
            cb(null, { cool: ['a', 7, true], echo: args });
        });
        
        node.write('enabled', function(value, peer, cb) {
            //console.log('Node write:', epid, peer, data);
            cb(null);
        });
        
        node.write('mist.name', function(value, peer, cb) {
            //console.log('writing mist.name to', value);
            name = value;
            node.changed('mist.name');
            cb(null);
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
    
    it('should check identity in core', function (done) {
        node.wish.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            console.log("got the identity list", err, data);
            done();
        });
    });
    
    it('shuold test control.model', function(done) {
        console.log('sending mist.control.model to peer:', peer);
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            done();
        });
    });
    
    var follow;
    
    
    // Expect follow to return current values for all readable endpoints
    it('shuold test control.follow', function(done) {
        var l = ['mist.name', 'enabled', 'lon', 'counter'];
        var end = false;
        follow = mist.request('mist.control.follow', [peer], function (err, data) {
            if (err) { if(data.code === 6) { return; } return done(new Error(inspect(data))); }
            //console.log("Follow update:", err, data, l);
            
            var index = l.indexOf(data.id);
            if (index !== -1) { l.splice(index, 1); }
            
            if (!end && l.length === 0) { end = true; done(); }
        });
    });
    
    it('shuold test control.read(counter)', function(done) {
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
    
    it('shuold test control.read(lon)', function(done) {
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
    
    it('shuold test control.read(enabled)', function(done) {
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
    
    it('shuold test control.write(non-existing)', function(done) {
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
    
    it('shuold test control.write(no data argument)', function(done) {
        mist.request('mist.control.write', [peer, 'lon'], function (err, data) {
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
    
    it('shuold test control.write(string to bool endpoint)', function(done) {
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
    
    it('shuold test control.write(bool to false)', function(done) {
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
        mist.request('mist.control.write', [peer, 'mist.name', string], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }
            
            //console.log("mist.control.write(name: string):", err, data);
            done();
        });
    });
    
    it('shuold test control.read string', function(done) {
        mist.request('mist.control.read', [peer, 'mist.name'], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }
            
            if (data !== string) { return done(new Error('Read did not return the string written in previous test. '+ data +' !== '+ string)); }
            
            //console.log("mist.control.read(name: string):", err, data);
            done();
        });
    });
    
    it('shuold test control.invoke', function(done) {
        //console.log('making an invoke to device.config');
        mist.request('mist.control.invoke', [peer, 'device.config', 'a-string'], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            if (typeof data.echo === 'string') {
                done();
            } else {
                done(new Error('Echo not same type', typeof data.echo));
            }
        });
    });
    
    it('shuold test control.invoke', function(done) {
        mist.request('mist.control.invoke', [peer, 'device.config', { complex: [1, true, "Three"] }], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            if (typeof data.echo === 'object') {
                done();
            } else {
                done(new Error('Echo not same type', typeof data.echo));
            }
        });
    });
    
    it('shuold test control.invoke with no value argument', function(done) {
        mist.request('mist.control.invoke', [peer, 'device.config'], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            //console.log('control.invoke with no value argument returned ', err, data);
            done();
            
        });
    });
    
    it('shuold test control.read error response', function(done) {
        mist.request('mist.control.read', [peer, 'readProblem'], function (err, data) {
            if (!err) { return done(new Error('Not an error as expected.')); }

            if (data.code !== 6) { return done(new Error('Not the expected error. '+data.code+': '+data.msg)); }

            done();
        });
    });
    
    it('shuold test control.write error response', function(done) {
        mist.request('mist.control.write', [peer, 'writeProblem'], function (err, data) {
            if (!err) { return done(new Error('Not an error as expected.')); }

            if (data.code !== 6) { return done(new Error('Not the expected error. '+data.code+': '+data.msg)); }

            done();
        });
    });
    
    it('shuold test control.invoke error response', function(done) {
        mist.request('mist.control.invoke', [peer, 'invokeProblem'], function (err, data) {
            if (!err) { return done(new Error('Not an error as expected.')); }

            if (data.code !== 6) { return done(new Error('Not the expected error. '+data.code+': '+data.msg)); }

            done();
        });
    });
    
    it('shuold test control.follow', function(done) {
        mist.request('mist.control.follow', [peer], function (err, data) {
            if (err) { return done(new Error(data.msg)); }

            if (data.id === 'enabled' && data.data === false) {
                //console.log('id is enabled and data is false...');
                done();
                done = function() {};
            }
        });
        
        enabled = false;
        node.changed('enabled');
    });    
    
    it('shuold remove device endpoint', function(done) {
        node.removeEndpoint('device');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            done();
        });
    });
    
    it('shuold remove first root endpoint', function(done) {
        node.removeEndpoint('mist');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            done();
        });
    });
    
    it('shuold remove all endpoints', function(done) {
        node.removeEndpoint('enabled');
        node.removeEndpoint('lon');
        node.removeEndpoint('counter');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            done();
        });
    });
});