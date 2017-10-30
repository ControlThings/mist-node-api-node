var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');

var bson = require('bson-buffer');
var BSON = new bson();

describe('MistApi Sandbox', function () {
    var mist;
    
    before('Setup Generic UI', function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

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

    var mistIdentity1;
    var mistIdentity2;
    
    var name1 = 'Alice';
    
    before(function(done) {
        util.clear(mist, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }
            done(); 
        });
    });
    
    before(function(done) {
        util.ensureIdentity(mist, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(mist, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');

    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 });
        
        node.create({
            enabled: { label: 'Enabled', type: 'bool', read: true, write: true },
            lon: { label: 'Longitude', type: 'float', read: true },
            counter: { label: 'Counter', type: 'int', read: true, write: true },
            config: { label: 'Config', type: 'invoke', invoke: true }
        });
        
        node.invoke('config', function(args, peer, cb) {
            cb({ cool: ['a', 7, true], echo: args });
        });
        
        node.write('enabled', function(value, peer, cb) {
            console.log('write:', value);
        });
        
        node.write('counter', function(value, peer, cb) {
            console.log('write:', value);
        });
        
        setTimeout(done, 200);
    });      
    
    var peer;

    before('should find a peer', function(done) {
        mist.request('listPeers', [], function(err, data) {
            console.log("mist.listPeers", err, data);
            
            var list = [];
            
            for (var i in data) {
                if( Buffer.compare(data[i].luid, mistIdentity1.uid) === 0 ) {
                    list.push(data[i]);
                }
            }
            
            if(list.length>0) {
                peer = list[0];
                console.log("Here is alice and the peer we added:", mistIdentity1, peer);
                done();
            } else {
                console.log('mistIdentity1 & 2', mistIdentity1, mistIdentity2);
                done(new Error('No peer found!'));
            }
        });
    });
    
    it('shuold list sandboxes', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            console.log("sandbox.list", err, data);
            done();
        });
    });
    
    it('shuold list wish identities', function(done) {
        mist.wish.request('identity.list', [], function(err, data) {
            console.log("all identities", err, data);
            done();
        });
    });

    var sandboxedGps;

    it('shuold add peer to gps sandbox', function(done) {
        
        sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        
        console.log('Sandbox login goes here:', gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);
            mist.request('sandbox.addPeer', [gpsSandboxId, peer], function(err, data) {
                console.log("addPeer response for gpsSandbox", err, data);

                var bogusPeer = { luid: peer.luid, ruid: mistIdentity2.uid, rhid: peer.rhid, rsid: peer.rsid, protocol: peer.protocol, online: false };

                mist.request('sandbox.addPeer', [gpsSandboxId, bogusPeer], function(err, data) {
                    console.log("addPeer response for gpsSandbox", err, data);
                    mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
                        console.log("peers allowed for gpsSandbox", err, data);
                        done();
                    });
                });
            });
        });
    });

    it('shuold test sandbox', function(done) {

        mist.request('signals', [], function(err, data) {
            console.log("Signal from MistApi", err, data);
        });

        sandboxedGps = new Sandboxed(mist, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);

            var ended = false;

            sandboxedGps.request('signals', [], function(err, data) {
                console.log("sandboxedGps signals:", err, data);
                
                if (data[0] === 'ready') {
                    sandboxedGps.request('listPeers', [], function(err, data) {
                        //console.log("sandboxedGps listPeers:", err, data);
                        
                        for(var i in data) {
                            if(!data[i].online) { continue; }
                            sandboxedGps.request('mist.control.model', [data[i], 'enabled'], function(err, data) {
                                console.log("sandboxedGps model:", err, data);
                                if(!ended) { ended = true; done(); }
                            });
                        }
                    });
                }
                
            });
        });
    });
    
    it('shuold list peers for gps sandbox', function(done) {
        mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
            console.log("peers allowed for gpsSandbox", err, data);
            done();
        });
    });
    
    it('shuold list identities in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('listPeers', [], function(err, data) {
                console.log("sandboxedGps listPeers:", err, data);

                sandboxedGps.request('wish.identity.list', [], function(err, data) {
                    console.log("ControlThings sandbox identities:", err, data);
                    done();
                });
            });
        });
    });
    
    it('shuold sign document in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);
            sandboxedGps.request('wish.identity.sign', [mistIdentity1.uid, { data: BSON.serialize({ msg: 'sandboxed signature' }) }], function(err, data) {
                //console.log("ControlThings sandbox signature:", err, data);
                if (!data.data) { return done(new Error('No data-field in response.')); }
                if (!data.signatures) { return done(new Error('No signaures-field in response.')); }
                if (!data.signatures[0]) { return done(new Error('No signaure[0]-field in response.')); }
                if (!data.signatures[0].sign) { return done(new Error('No signaure[0].sign-field in response.')); }
                
                done();
            });
        });
    });

    it('shuold be sandboxed ', function(done) {
        sandboxedGps.request('mist.control.model', [peer], function(err, data) {
            if (err) { return done(new Error('Could not get model from peer, before remove peer test.')); }
            
            mist.request('sandbox.removePeer', [gpsSandboxId, peer], function(err, data) {
                console.log("Peer was removed?: ", err, data);

                sandboxedGps.request('mist.control.model', [peer], function(err, data) {
                    if (err && data.code === 55) {
                        return done();
                    }
                    
                    console.log("model", err, data);
                    done(new Error('Got model while expecting "Peer not found"!'));
                });
            });
        });
    });

    /*
    it('shuold test a second sandbox', function(done) {
        var sandboxedControlThings = new Sandboxed(mist, controlThingsSandboxId);
        
        sandboxedControlThings.request('login', ['ControlThings App'], function(err, data) {
            console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedControlThings.request('listPeers', [], function(err, peers) {
                console.log("ControlThings peers:", err, peers);
                done();
            });
        });
    });
    */
    
});