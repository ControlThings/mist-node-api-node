var Mist = require('../index.js').Mist;
var Sandboxed = require('../index.js').Sandboxed;

var mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

mist.request('ready', [], function(err, data) {
    console.log("MistApi ready():", err, data);
    mist.wish('identity.list', [], function(err, data) {
        console.log("Identities:", err, data, data.length);
        if (data.length === 0) {
            mist.wish('identity.create', ['Mr. Andersson'], function(err, data) {
                console.log("We just created an identity for you.", err, data);
            });
        }
    });
});

mist.request('signals', [], function(err, data) {
    console.log("Signal from MistApi", err, data);
    
    if (data[0] === 'sandboxed.settings') {
        console.log("Got request to open settings for a sandbox:", data[1]);
    } else if (data[0] === 'sandboxed.login') {
        //console.log("Someone logged in to a sandbox... updating list.");
        
        mist.request('sandbox.list', [], function(err, data) {
            //console.log("Sandbox list reponse:", err, data);
            
            for (var i in data) {
                if ( Buffer.compare(data[i].id, soikeaSandboxId) === 0 ) {
                    console.log("Found the soikea sandbox for adding a peer:", data[i]);
                    
                    var sandboxId = data[i].id; 

                    mist.request('listPeers', [], function(err, data) {
                        var peers = [];
                        for(var i in data) {
                            peers.push(data[i]);
                        }

                        console.log("Peers available:", peers.length);

                        for(var x in peers) {
                            //console.log("Requesting to add peer.", peers[x].rsid.toString());
                            if ( peers[x].rsid.slice(0,11).toString() !== 'GPS node.js' ) { continue; }
                            mist.request('sandbox.addPeer', [sandboxId, peers[x]], function(err, data) {
                                console.log("Sandbox addPeer reponse:", err, data);
                            });
                        }
                    });
                }
            }
        });
    }
});

var soikeaSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');

var sandboxedSoikea = new Sandboxed(mist, soikeaSandboxId);
var sandboxedControlThings = new Sandboxed(mist, controlThingsSandboxId);

sandboxedSoikea.request('login', ['Soikea App'], function(err, data) {
    console.log("Sandbox login reponse:", err, data);

    mist.request('sandbox.list', [], function(err, data) {
        console.log("Sandbox list reponse:", err, data);
    });
});

sandboxedControlThings.request('login', ['ControlThings App'], function(err, data) {
    console.log("ControlThings Sandbox login reponse:", err, data);

    sandboxedControlThings.request('listPeers', [], function(err, peers) {
        console.log("ControlThings peers:", err, peers);
    });
});

sandboxedSoikea.request('signals', [], function(err, data) {
    console.log("Signal from sandbox", err, data);
    
    if (data === 'peers') {
        sandboxedSoikea.request('listPeers', [], function(err, data) {
            console.log("Soikea sandboxed listPeers reponse:", err, data);
            
            for (var i in data) {
                (function(peer) {
                    if (peer.online) {
                        //console.log("issuing sandboxed.mist.control.model for", peer);
                        sandboxedSoikea.request('mist.control.model', [peer], function (err, model) {
                            console.log("Got a model:", err, model);

                            /*
                            setTimeout(function() { mist.request('mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 500);
                            setTimeout(function() { mist.request('mist.control.write', [peer, 'button1', false], function (err, data) {}); }, 600);
                            setTimeout(function() { mist.request('mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 700);
                            setTimeout(function() { mist.request('mist.control.write', [peer, 'button1', false], function (err, data) {}); }, 800);
                            setTimeout(function() { mist.request('mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 900);
                            */

                            setTimeout(function() {
                                sandboxedSoikea.request('mist.control.write', [peer, 'enabled', false], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1000);

                            setTimeout(function() {
                                sandboxedSoikea.request('mist.control.write', [peer, 'enabled', true], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1500);

                            setTimeout(function() {
                                sandboxedSoikea.request('mist.control.invoke', [peer, 'config', [{ that: 'this!' }, { cool: 'thing', bin: new Buffer("Binary safe"), more: [1,2,3], ding: 'dong', tick: 'tack'}, 7]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2000);

                            setTimeout(function() {
                                sandboxedSoikea.request('mist.control.invoke', [peer, 'config', [{ that: 'this!' }, 57]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2500);

                            
                            var followId = sandboxedSoikea.request('mist.control.follow', [peer], function (err, data) {
                                console.log("Follow:", err, data);
                            });
                            
                            setTimeout(function() {
                                console.log("Canceling request", followId);
                                sandboxedSoikea.requestCancel(followId);
                                setTimeout(function() { mist.shutdown(); }, 200);
                            }, 5000);
                        });
                    }
                })(data[i]);
            }
        });
    }
});


sandboxedSoikea.request('settings', [{ hint: 'commission' }], function(err, data) {
    console.log("sandbox settings response", err, data);
});

setTimeout(function() {
    mist.request('sandbox.list', [], function(err, data) {
        //console.log("Sandbox list reponse:", err, data);
        
        for (var i in data) {
            if ( Buffer.compare(data[i].id, soikeaSandboxId) === 0 ) {
                console.log("Found the soikea sandbox:", data[i]);
                mist.request('sandbox.listPeers', [soikeaSandboxId], function (err, data) {
                    
                    // delete a single peer
                    
                    for(var i in data) {
                        console.log("Mist sandbox found a peer to delete:", err, data);
                        mist.request('sandbox.removePeer', [soikeaSandboxId, data[i]], function (err, data) {
                            console.log("Sandbox list reponse:", err, data);
                            
                            mist.request('sandbox.listPeers', [soikeaSandboxId], function (err, data) {
                                console.log("Sandbox listPeers after remove:", err, data);
                            });                            
                        });
                        return;
                    }
                    
                    console.log("No peer to delete.");
                    
                });
            }
        }
    });
}, 3000);


setTimeout(function() {
    sandboxedSoikea.request('logout', [], function(err, data) {
        console.log("Sandbox logout reponse:", err, data);

        mist.request('sandbox.list', [], function(err, data) {
            console.log("Sandbox list reponse:", err, data);
        });
    });
}, 5000);

