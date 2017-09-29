var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    var mistIdentity;
    
    var name = 'Mr. Andersson';
    
    before('should setup calling node', function (done) {
        mist = new MistNode({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9095 });

        mist.on('ready', function() {
            util.clear(mist.wish, function(err) {
                if (err) { done(new Error('util.js: Could not clear core.')); }
                
                util.ensureIdentity(mist.wish, name, function(err, identity) {
                    if (err) { done(new Error('util.js: Could not ensure identity.')); }

                    mistIdentity = identity;
                    done(); 
                });
            });
        });
    });

    var peer;
    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); //, coreIp: '127.0.0.1', corePort: 9095
        node.create({
            state: { label: 'State', type: 'bool', read: true, write: true } 
        });
        
        node.write('state', function(value, peer, cb) {
            console.log('Node write state:', value);
            node.update('state', value);
            cb();
        });
        
        setTimeout(done, 1000);
    });

    before('should find the peer', function(done) {
        function peers(data) {
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
        
        mist.onlineCb = function(peer) { 
            peers([peer]);
        };
        
        peers(mist.peers);
    });
    
    it('shuold test control.model', function(done) {
        mist.request(peer, 'control.model', [], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            done();
        });
    });
    
    it('shuold test control.write', function(done) {
        mist.request(peer, 'control.write', ['state', true], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            done();
        });
    });
});
