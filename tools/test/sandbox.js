var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

describe('MistApi Sandbox', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, ready) {
            if (ready) {
                done();
            } else {
                done(new Error('MistApi not ready, bailing.'));
            }
        });
    });
    
    after(function(done) {
        mist.shutdown();
        done();
    });


    it('should get signals', function(done) {
        mist.request('signals', [], function(err, data) {
            //console.log("signals", err, data);
            done();
            done = function() {};
        });
    });
    
    it('should be just fine', function (done) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            
            if (data.length === 0) {
                //console.log("Created identity.");
                mist.wish('identity.create', ['Mr. Andersson'], function(err, data) {
                    console.log("Wish core had no identities. One has been created. Re-run test.");
                    process.exit(1);
                });
            } else {
                done();
            }
        });
    });
    
    it('should list peers', function(done) {
        mist.request('listPeers', [], function(err, data) {
            //console.log('List is this', err, data);
            done();
        });
    });
    
    it('shuold test sandbox', function(done) {

        this.timeout(5000);

        mist.request('signals', [], function(err, data) {
            //console.log("Signal from MistApi", err, data);

            if (data[0] === 'sandboxed.settings') {
                //console.log("Got request to open settings for a sandbox:", data[1]);
            } else if (data[0] === 'sandboxed.login') {
                //console.log("Someone logged in to a sandbox... updating list.");

                mist.request('sandbox.list', [], function(err, data) {
                    //console.log("Sandbox list reponse:", err, data);

                    for (var i in data) {
                        if ( Buffer.compare(data[i].id, gpsSandboxId) === 0 ) {
                            //console.log("Found the GpsApp sandbox for adding a peer:", data[i]);

                            var sandboxId = data[i].id; 

                            mist.request('listPeers', [], function(err, data) {
                                var peers = [];
                                for(var i in data) {
                                    peers.push(data[i]);
                                }

                                //console.log("Peers available:", peers.length);

                                for(var x in peers) {
                                    //console.log("Requesting to add peer.", peers[x].rsid.toString());
                                    if ( peers[x].rsid.slice(0,11).toString() !== 'GPS node.js' ) { continue; }
                                    mist.request('sandbox.addPeer', [sandboxId, peers[x]], function(err, data) {
                                        //console.log("Sandbox addPeer reponse:", err, data);
                                    });
                                }
                            });
                        }
                    }
                });
            }
        });

        var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
        var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');

        var sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        var sandboxedControlThings = new Sandboxed(mist, controlThingsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("Sandbox login reponse:", err, data);

            mist.request('sandbox.list', [], function(err, data) {
                //console.log("Sandbox list reponse:", err, data);
            });
        });

        sandboxedControlThings.request('login', ['ControlThings App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedControlThings.request('listPeers', [], function(err, peers) {
                //console.log("ControlThings peers:", err, peers);
            });
        });

        function peers(err, data) {
            //console.log("GpsApp sandboxed listPeers reponse:", err, data);

            for (var i in data) {
                (function (peer) {
                    if (peer.online) {
                        //console.log("issuing sandboxed.mist.control.model for", peer);
                        sandboxedGps.request('mist.control.model', [peer], function (err, model) {
                            //console.log("Got a model:", err, model);

                            var end = false;

                            var followId = sandboxedGps.request('mist.control.follow', [peer], function (err, data) {
                                if (!end) {
                                    end = true;
                                    sandboxedGps.requestCancel(followId);

                                    sandboxedGps.request('logout', [], function (err, success) {
                                        //console.log("Sandbox logout reponse:", err, success);

                                        mist.request('sandbox.list', [], function (err, data) {
                                            console.log("Calling mist.shutdown().");
                                            mist.shutdown();
                                            process.nextTick(function() { console.log('exiting.'); process.exit(0); });
                                            done();
                                        });
                                    });
                                }
                            });
                        });
                    }
                })(data[i]);
            }
        };

        sandboxedGps.request('signals', [], function(err, data) {
            //console.log("Signal from sandbox", err, data);

            if (data === 'peers') {
                sandboxedGps.request('listPeers', [], peers);
            }
        });

        sandboxedGps.request('listPeers', [], peers);

        sandboxedGps.request('settings', [{ hint: 'commission' }], function(err, data) {
            //console.log("sandbox settings response", err, data);
        });

        /*
        setTimeout(function() {
            mist.request('sandbox.list', [], function(err, data) {
                //console.log("Sandbox list reponse:", err, data);

                for (var i in data) {
                    if ( Buffer.compare(data[i].id, gpsSandboxId) === 0 ) {
                        //console.log("Found the Gps sandbox:", data[i]);
                        mist.request('sandbox.listPeers', [gpsSandboxId], function (err, data) {

                            // delete a single peer

                            for(var i in data) {
                                //console.log("Mist sandbox found a peer to delete:", err, data);
                                mist.request('sandbox.removePeer', [gpsSandboxId, data[i]], function (err, data) {
                                    //console.log("Sandbox list reponse:", err, data);

                                    mist.request('sandbox.listPeers', [gpsSandboxId], function (err, data) {
                                        //console.log("Sandbox listPeers after remove:", err, data);
                                    });                            
                                });
                                return;
                            }

                            //console.log("No peer to delete.");

                        });
                    }
                }
            });
        }, 1000);
        */
    });
    
});