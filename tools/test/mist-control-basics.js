var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    var mistIdentity;
    
    var name = 'Mr. Andersson';
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data === 'ready') {
                    util.clear(mist, function(err) {
                        if (err) { done(new Error('util.js: Could not clear core.')); }
                        
                        util.ensureIdentity(mist, name, function(err, identity) {
                            if (err) { done(new Error('util.js: Could not ensure identity.')); }
                            
                            mistIdentity = identity;
                            done(); 
                        });
                    });
                }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    var peer;
    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings' }); //, coreIp: '127.0.0.1', corePort: 9094
        node.create({
            device: 'ControlThings',
            model: { 
                state: { label: 'State', type: 'bool', read: true, write: true } 
            } 
        });
        
        node.write(function(epid, data) {
            console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 1000);
    });

    before('should find the peer', function(done) {
        function peers(err, data) {
            for(var i in data) {
                if ( Buffer.compare(data[i].luid, mistIdentity.uid) === 0 
                        && Buffer.compare(data[i].ruid, mistIdentity.uid) === 0 ) 
                {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); continue; }

                    peer = data[0];
                    //console.log("The peers is:", peer);
                    done();
                    done = function() {};
                    
                    break;
                }
            }
        }
        
        mist.request('signals', [], function(err, signal) { 
            console.log('signal:', err, signal);
            
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                mist.request('listPeers', [], peers);
            }
        });
        
        mist.request('listPeers', [], peers);
    });
    
    it('shuold test control.model', function(done) {
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            done();
        });
    });
    
    it('shuold test control.write', function(done) {
        mist.request('mist.control.write', [peer, 'state', true], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            done();
        });
    });
});