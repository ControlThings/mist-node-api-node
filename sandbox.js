var Mist = require('./').Mist;
var Sandboxed = require('./').Sandboxed;

var mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

mist.request('signals', [], function(err, data) {
    console.log("Signal from MistApi", err, data);
    
    if (data[0] === 'sandboxed.settings') {
        console.log("Got request to open settings for a sandbox:", data[1]);
    } else if (data[0] === 'sandboxed.login') {
        console.log("Someone logged in to a sandbox... updating list.");
        
        mist.request('sandbox.list', [], function(err, data) {
            console.log("Sandbox list reponse:", err, data);
            
            var sandbox = data[0].id; 
            
            mist.request('listPeers', [], function(err, data) {
                console.log("Peers available reponse:", err, data);
                
                var peers = [];
                for(var i in data) {
                    peers.push(data[i]);
                }

                for(var x in peers) {
                    console.log("Requesting to add peer ")
                    mist.request('sandbox.addPeer', [sandbox, peers[x]], function(err, data) {
                        console.log("Sandbox addPeer reponse:", err, data);
                    });
                }
            });
        });
    }
});


var sandboxed = new Sandboxed(mist);

/*
mist.request('sandboxed.listPeers', [], function(err, data) {
    console.log("Sandbox reponse:", err, data);
});
*/

var sandboxId = new Buffer('ff00abababababababababababababababababababababababababababababab', 'hex');

var peer1 = {
    luid: new Buffer('abababababababababababababababababababababababababababababababab', 'hex'),
    ruid: new Buffer('bbababababababababababababababababababababababababababababababab', 'hex'),
    rhid: new Buffer('cbababababababababababababababababababababababababababababababab', 'hex'),
    rsid: new Buffer('dbababababababababababababababababababababababababababababababab', 'hex'),
    protocol: 'ucp'
};

var peer2 = {
    luid: new Buffer('2aababababababababababababababababababababababababababababababab', 'hex'),
    ruid: new Buffer('2bababababababababababababababababababababababababababababababab', 'hex'),
    rhid: new Buffer('2cababababababababababababababababababababababababababababababab', 'hex'),
    rsid: new Buffer('2dababababababababababababababababababababababababababababababab', 'hex'),
    protocol: 'ucp'
};

sandboxed.request('sandboxed.login', ['Soikea App'], function(err, data) {
    console.log("Sandbox login reponse:", err, data);

    sandboxed.request('sandbox.list', [], function(err, data) {
        console.log("Sandbox list reponse:", err, data);
    });
});

sandboxed.request('sandboxed.signals', [], function(err, data) {
    console.log("Signal from sandbox", err, data);
    
    if (data === 'peers') {
        sandboxed.request('sandboxed.listPeers', [], function(err, data) {
            console.log("Sandbox listPeers reponse:", err, data);
            
            for (var i in data) {
                (function(peer) {
                    if (peer.online) {
                        console.log("issuing sandboxed.mist.control.model for", peer);
                        sandboxed.request('sandboxed.mist.control.model', [peer], function (err, model) {
                            console.log("Got a model:", err, model);

                            /*
                            setTimeout(function() { mist.request('sandboxed.mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 500);
                            setTimeout(function() { mist.request('sandboxed.mist.control.write', [peer, 'button1', false], function (err, data) {}); }, 600);
                            setTimeout(function() { mist.request('sandboxed.mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 700);
                            setTimeout(function() { mist.request('sandboxed.mist.control.write', [peer, 'button1', false], function (err, data) {}); }, 800);
                            setTimeout(function() { mist.request('sandboxed.mist.control.write', [peer, 'button1', true], function (err, data) {}); }, 900);
                            */

                            setTimeout(function() {
                                sandboxed.request('sandboxed.mist.control.write', [peer, 'button1', false], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1000);

                            setTimeout(function() {
                                sandboxed.request('sandboxed.mist.control.write', [peer, 'button1', true], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1500);

                            setTimeout(function() {
                                sandboxed.request('sandboxed.mist.control.invoke', [peer, 'config', [{ that: 'this!' }, { cool: 'thing', more: [1,2,3], ding: 'dong', tick: 'tack'}, 7]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2000);

                            setTimeout(function() {
                                sandboxed.request('sandboxed.mist.control.invoke', [peer, 'config', [{ that: 'this!' }, 57]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2500);

                            
                            var followId = sandboxed.request('sandboxed.mist.control.follow', [peer], function (err, data) {
                                console.log("Follow:", err, data);
                                
                            });
                            
                            setTimeout(function() {
                                console.log("Canceling request", followId);
                                sandboxed.requestCancel(followId);
                            }, 5000);
                        });
                    }
                })(data[i]);
            }
        });
    }
});


sandboxed.request('sandboxed.settings', [{ hint: 'commission' }], function(err, data) {
    console.log("sandbox settings response", err, data);
});

setTimeout(function() {
    sandboxed.request('sandboxed.logout', [], function(err, data) {
        console.log("Sandbox logout reponse:", err, data);

        sandboxed.request('sandbox.list', [], function(err, data) {
            console.log("Sandbox list reponse:", err, data);
        });
    });
}, 5000);

