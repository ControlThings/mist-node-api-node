var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var MistNode = require('../../index.js').MistNode;

describe('MistApi Sandbox', function () {
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

    var aliceAlias = 'Alice';
    var aliceIdentity;
    var unimportantIdentity;

    before('should ensure identity for Alice', function(done) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("Ensuring identity of Alice.", data);

            var c = 0;
            var t = 0;
            
            for(var i in data) {
                c++;
                t++;
                mist.wish('identity.remove', [data[i].uid], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    c--;
                    
                    if ( c===0 ) {
                        console.log("Deleted ", t, 'identities.');
                        done();
                    }
                });
            }
            
            if(t===0) { done(); }
        });
    });

    before('should ensure identity for Alice', function(done) {
        mist.wish('identity.create', [aliceAlias], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            //console.log("Setting Alice identity to:", err, data);
            aliceIdentity = data;
            done();
        });
    });

    before('should ensure identity for Mr. Unimportant', function(done) {
        mist.wish('identity.create', ['Mr. Unimportant'], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            unimportantIdentity = data;
            done();
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');

    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings' }); // , coreIp: '127.0.0.1', corePort: 9094
        
        node.create({
            device: 'ControlThings',
            model: { 
                enabled: { label: 'Enabled', type: 'bool', read: true, write: true },
                lon: { label: 'Longitude', type: 'float', read: true },
                counter: { label: 'Counter', type: 'int', read: true, write: true },
                config: { label: 'Config', invoke: true }
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
    
    var peer;

    it('should find a peer', function(done) {
        mist.request('listPeers', [], function(err,data) {
            console.log("mist.listPeers", err, data);
            
            var list = [];
            
            for (var i in data) {
                if( Buffer.compare(data[i].luid, aliceIdentity.uid) === 0 ) {
                    list.push(data[i]);
                }
            }
            
            
            if(list.length>0) {
                peer = list[0];
                console.log("Here is alice and the peer we added:", aliceIdentity, peer);
                done();
            } else {
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
        mist.wish('identity.list', [], function(err, data) {
            console.log("all identities", err, data);
            done();
        });
    });

    var sandboxedGps;

    it('shuold add peer to gps sandbox', function(done) {
        
        sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);
            mist.request('sandbox.addPeer', [gpsSandboxId, peer], function(err, data) {
                console.log("addPeer response for gpsSandbox", err, data);

                var bogusPeer = { luid: peer.luid, ruid: unimportantIdentity.uid, rhid: peer.rhid, rsid: peer.rsid, protocol: peer.protocol, online: false };

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
                
                if (data === 'ready') {
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