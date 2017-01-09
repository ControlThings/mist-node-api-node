var Mist = require('./').Mist;

var mist = new Mist({ name: 'TheUI', coreIp: '127.0.0.1', corePort: 9094 });

/*
mist.request('sandbox.listPeers', [], function(err, data) {
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

mist.request('sandbox.signals', [], function(err, data) {
    //console.log("Signal from sandbox", err, data);
    
    if (data === 'peers') {
        mist.request('sandbox.listPeers', [sandboxId], function(err, data) {
            //console.log("Sandbox listPeers reponse:", err, data);
            
            for (var i in data) {
                (function(peer) {
                    //console.log("issuing sandbox.control.model for", peer);
                    if (peer.online) {
                        mist.request('sandbox.control.model', [sandboxId, peer], function (err, model) {
                            //console.log("Got a model:", err, model);

                            /*
                            setTimeout(function() { mist.request('sandbox.control.write', [sandboxId, peer, 'button1', true], function (err, data) {}); }, 500);
                            setTimeout(function() { mist.request('sandbox.control.write', [sandboxId, peer, 'button1', false], function (err, data) {}); }, 600);
                            setTimeout(function() { mist.request('sandbox.control.write', [sandboxId, peer, 'button1', true], function (err, data) {}); }, 700);
                            setTimeout(function() { mist.request('sandbox.control.write', [sandboxId, peer, 'button1', false], function (err, data) {}); }, 800);
                            setTimeout(function() { mist.request('sandbox.control.write', [sandboxId, peer, 'button1', true], function (err, data) {}); }, 900);
                            */

                            setTimeout(function() {
                                mist.request('sandbox.control.write', [sandboxId, peer, 'button1', false], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1000);

                            setTimeout(function() {
                                mist.request('sandbox.control.write', [sandboxId, peer, 'button1', true], function (err, data) {
                                    console.log("Write success?:", err, data);                                
                                });
                            }, 1500);

                            setTimeout(function() {
                                mist.request('sandbox.control.invoke', [sandboxId, peer, 'config', [{ that: 'this!' }, { cool: 'thing', more: [1,2,3], ding: 'dong', tick: 'tack'}, 7]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2000);

                            setTimeout(function() {
                                mist.request('sandbox.control.invoke', [sandboxId, peer, 'config', [{ that: 'this!' }, 57]], function (err, data) {
                                    console.log("Invoke success?:", err, data);                                
                                });
                            }, 2500);

                            
                            var followId = mist.request('sandbox.control.follow', [sandboxId, peer], function (err, data) {
                                console.log("Follow:", err, data);
                                
                            });
                            
                            setTimeout(function() {
                                console.log("Canceling request", followId);
                                mist.requestCancel(followId);
                            }, 5000);
                        });
                    }
                })(data[i]);
            }
        });
    }
});

mist.request('mist.sandbox.register', [sandboxId], function(err, data) {
    console.log("Sandbox register reponse:", err, data);
    
    /*
    mist.request('mist.sandbox.addPeer', [sandboxId, peer1], function(err, data) {
        console.log("Sandbox addPeer reponse:", err, data);

        mist.request('mist.sandbox.list', [], function(err, data) {
            console.log("Sandbox list reponse:", err, data);

            setTimeout(function() {
                mist.request('mist.sandbox.addPeer', [sandboxId, peer2], function(err, data) {
                    console.log("Sandbox addPeer reponse:", err, data);

                    mist.request('mist.sandbox.list', [], function(err, data) {
                        console.log("Sandbox list reponse:", err, data);

                    });
                });
            }, 1500);

        });
    });
    */
});


mist.request('mist.signals', [], function(err, data) {
    if (data === 'peers') {
        console.log("got peers from mist.signals.");
        mist.request('mist.listServices', [], function(err, data) {
            console.log("mist.listServices response", err, data);
            
            mist.request('mist.sandbox.addPeer', [sandboxId, data[0]], function(err, data) {
                console.log("Sandbox addPeer reponse:", err, data);
            });
            
        });
    }
});

