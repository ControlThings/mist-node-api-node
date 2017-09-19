var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;

var inspect = require('util').inspect;

describe('MistApi Control', function () {
    var mist;
    var mistIdentity;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });
    
    after(function(done) {
        done();
    });

    var peer;
    var node;

    it('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        node.create({
            device: 'ControlThings',
            model: { 
                enabled: { label: 'Enabled', type: 'bool', read: true, write: true },
                lon: { label: 'Longitude', type: 'float', read: true },
                counter: { label: 'Counter', type: 'int', read: true, write: true },
                config: { label: 'Config', invoke: true },
            } 
        });
        
        node.invoke('config', function(args, cb) {
            cb({ cool: ['a', 7, true], echo: args });
        });
        
        node.write(function(epid, data) {
            console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 200);
    });  

    it('should find the peer', function(done) {
        function peers(err, data) {
            //console.log('==========================', data, mistIdentity);
            for(var i in data) {
                if ( Buffer.compare(new Buffer('ControlThings'), data[i].rsid.slice(13)) ) {
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
    
    it('shuold test control.model', function(done) {
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model:", err, inspect(model, null, null, true));
            done();
        });
    });
});
