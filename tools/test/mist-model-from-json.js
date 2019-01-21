var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('Mist Model', function () {
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

    before('should start a mist node, creating model from JSON document', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.create({ 
            "mist": {
                "type": "string",
                "#": {
                    "name": {
                        "label": "Name",
                        "type": "string",
                        "read": true
                    }
                }
            },
            "test": { "label": "This is a test", "type": "string" },
            "level0": {
                "type": "string",
                "#": {
                    "type": "string",
                    "level1": {
                        "label": "Name",
                        "type": "string",
                        "read": true,
                        '#': {
                            "type": "string",
                            "level2": {
                                "label": "Name",
                                "type": "string",
                                "read": true
                            }
                        }
                    }
                }
            } 
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
            console.log("got the identity list", err, inspect(data));
            if (data[0]) {
                done();
            }
        });
    });
    
    it('shuold test control.model', function(done) {
        console.log('sending mist.control.model to peer:', peer);
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            console.log("Got a model:", err, model);
            
            if (typeof data !== 'undefined' && typeof data.mist !== 'undefined' && typeof data.test === 'undefined') {
                done();
            }
            
            done();
        });
    });
    
    /*
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
    */
});