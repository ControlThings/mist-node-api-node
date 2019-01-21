var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var app1;
var app2;

var mistIdentity1;
var mistIdentity2;

describe('MistApi Sandbox', function () {
    var mist1;
    var mist2;

    before(function(done) {
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
    
    before(function(done) {
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        app2.once('ready', function() {
            done();
        });
    });
    
    before(function (done) {
        mist1 = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9095 });

        setTimeout(function() {
            mist1.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });

    before(function(done) {
        mist2 = new Mist({ name: 'Generic UI2', corePort: 9096 });

        setTimeout(function() {
            mist2.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });
    
    before(function(done) {
        util.clear(mist1, done);
    });

    before(function(done) {
        util.clear(mist2, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    before(function(done) {
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
    
    before(function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9096 });
        node.create({
            state: { label: 'State', type: 'bool', read: true, write: true } 
        });
        
        node.write('state', function(value, peer, cb) {
            console.log('write "state":', value);
            cb(null);
        });
        
        setTimeout(done, 100);
        
    });

    var app2hid;
    var app2sid;

    before(function(done) {
        app2.request('host.config', [], function(err, data) {
            //console.log('app2: host.config', err, data);
            app2hid = data.hid;
            done();
        });
    });

    before(function(done) {
        mist2.request('getServiceId', [], function(err, data) {
            //console.log('app2: sid', err, data.wsid);
            app2sid = data.wsid;
            done();
        });
    });

    var app2serviceCert;

    before(function(done) {
        app2.request('identity.export', [mistIdentity2.uid], function(err, data) {
            //console.log('exported:', err, data);
            var cert = BSON.deserialize(data.data);
            cert.hid = app2hid;
            cert.sid = app2sid;
            cert.protocol = 'ucp';
            
            data.data = BSON.serialize(cert);
            
            app2.request('identity.sign', [mistIdentity2.uid, data], function(err, data) {
                //console.log("the cert we publish:", err, data);
                app2serviceCert = data;
                done();
            });
        });
    });
    
    before(function(done) {
        mist2.wish.request('identity.list', [], function(err, data) {
            //console.log('services.list', err, data);
            done();
        });
    });
    
    after(function(done) {
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });    
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    
    var sandboxedGps;
    
    var requestToBeAccepted;
    
    it('shuold test sandbox settings without hint', function(done) {

        var signals = mist1.request('signals', [], function(err, data) {
            //console.log("Signal from MistApi", err, inspect(data, null, 10, true));
            if(data[0] && data[0] === 'sandboxed.settings') {
                requestToBeAccepted = data[1];
                done();
                //console.log('canceling', signals);
                mist1.requestCancel(signals);
            }
        });

        sandboxedGps = new Sandboxed(mist1, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            sandboxedGps.request('wish.identity.list', [null], function(err, data) {
                //console.log('Sandbox sees these identities:', err, data);
                
                if (data[0]) {
                    var uid = data[0].uid;
                    
                    
                    
                    //var cert = BSON.serialize({ data: BSON.serialize({ alias: 'Mr Someone', uid: new Buffer(32), pubkey: new Buffer(32), hid: new Buffer(32), sid: new Buffer(32), protocol: 'ucp' }), meta: new Buffer(16), signatures: [] });
                    var cert = app2serviceCert;
                    
                    //console.log('sending request from sandbox', [uid, cert]);
                    
                    sandboxedGps.request('wish.identity.friendRequest', [null, uid, cert], function(err, data) {
                        console.log('Sandbox got response for wish.identity.friendRequest', err, data);
                    });
                }
            });
            
        });
    });
    
    it('should accept the request from sandbox', function(done) {
        // 'sandbox.addPeer'
        
        var signals = app2.request('signals', [], function(err, data) {
            //console.log('app2 signals:', err, data);
            if (data[0] === 'friendRequest')  {
                app2.cancel(signals);
                done();
                done = function() {};
            }
        });
        
        mist1.request('sandbox.allowRequest', [requestToBeAccepted.id, requestToBeAccepted.opts], function(err, data) {
            if (err) { console.log('Error: sandbox.allowRequest response:', err, data); }
            //done();
        });
    });
    
    var sandboxPeer;
    
    it('should accept friend request and see peer in sandbox', function(done) {
        this.timeout(5000);
        var signals = sandboxedGps.request('signals', [], function(err, data) {
            if (data === 'peers' || data[0] === 'peers') {
                sandboxedGps.request('listPeers', [], function(err, data) {
                    if (data.length !== 1) { return done(new Error('Not exactly one peer in sandbox! '+ data.length)); }
                    
                    var peerCert = BSON.deserialize(app2serviceCert.data);
                    
                    if ( Buffer.compare(data[0].luid, mistIdentity1.uid) !== 0 ) { return done(new Error('Sandbox peer luid incorrect!')); }
                    if ( Buffer.compare(data[0].ruid, peerCert.uid) !== 0 ) { return done(new Error('Sandbox peer ruid incorrect!')); }
                    if ( Buffer.compare(data[0].rhid, peerCert.hid) !== 0 ) { return done(new Error('Sandbox peer rhid incorrect!')); }
                    if ( Buffer.compare(data[0].rsid, peerCert.sid) !== 0 ) { return done(new Error('Sandbox peer rsid incorrect!')); }
                    
                    sandboxPeer = data[0];
                    
                    sandboxedGps.requestCancel(signals);
                    done();
                    done = function() { }
                });
            }
        });
        

        app2.request('identity.friendRequestList', [], function(err, data) {
            //console.log('app2 friendRequestList:', err, data);
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list! there were ' + data.length + ' friend requests'));
            }
            
            var handled = false;
            var friendRuid = data[0].ruid;
            app2.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                //console.log('app2 friendRequestAccept:', err, data);
                //if (handled) { return }
                handled = true;
                app2.request('identity.permissions', [friendRuid, { core: { owner: true } }], function(err, data) {
                   if (err) { done(new Error('identity.permissions error: ' + inspect(data))); } 
                });
                app2.request('identity.update', [friendRuid, { connect: false } ], function(err, data) {
                   if (err) { done(new Error('identity.update error: ' + inspect(data))); } 
                   console.log("Identity update: ", data)
                });
            });
        });        
    });
    
    it('should get a remote wish signal', function(done) {
        var peer = { luid: sandboxPeer.luid, ruid: sandboxPeer.ruid, rhid: sandboxPeer.rhid };

        var signals = sandboxedGps.request('wish.signals', [peer], function(err, data) {
            if (data[0] === 'identity') { done(); done = function() {}; sandboxedGps.cancel(signals); }
            
            if (data[0] === 'ok') {
                sandboxedGps.request('wish.identity.update', [peer, peer.luid, { payment: { BCH: '1Ms7pFFeRbj9m6bb6jbsbA23MAC4SQJeEY' }, telephone: '+35812312312' }], function(err, data) {
                    if (err) { new Error("wish.identity.update error: " + inspect(data)); }
                    
                });
            }
        });
    });
    
    it('should get a remote wish identity', function(done) {
        var peer = { luid: sandboxPeer.luid, ruid: sandboxPeer.ruid, rhid: sandboxPeer.rhid };

        sandboxedGps.request('wish.identity.get', [peer, peer.luid], function(err, data) {
            //console.log('Here you go', err, data.meta);
            if (err) { done (new Error("Error in wish.identity.get " + inspect(data))) }
            done();
        });
    });
    
    it('should get a remote wish identity friend request and accept it', function(done) {
        this.timeout(4000);
        var peer = { luid: sandboxPeer.luid, ruid: sandboxPeer.ruid, rhid: sandboxPeer.rhid };
        
        app2.request("signals", [], function(err, data) {
            if (data[0] === 'friendRequest') {
                console.log("app2 friendRequest!")
            } 
        });

        var lsignals;

        console.log('About to start waiting for signals so that we can list remote friendRequests');
        
        var signals = sandboxedGps.request('wish.signals', [peer], function(err, data) {
            
            if (signals === 0) {
                return;
            }
            
            
            if (err) { done (new Error('wish.signals request fails ' + inspect(data))); }
            console.log("wish.signals from peer: ", data);
            if (data[0] === 'friendRequest') {
                //sandboxedGps.requestCancel(signals);
                sandboxedGps.requestCancel(signals);
                signals = 0;
                mist1.requestCancel(lsignals);
                console.log('about to list remote friendRequests');
                
                sandboxedGps.request('wish.identity.friendRequestList', [peer], function(err, data) {
                    console.log('remote friendRequest list:', err, data);
                    if (err) { done (new Error('wish.identity.friendRequestList fails ' + inspect(data))); }
                    sandboxedGps.request('wish.identity.friendRequestAccept', [peer, data[0].luid, data[0].ruid], function(err, data) {
                        //console.log('remote friendRequest Accept:', err, data);
                        done();
                        
                    });
                });
            }
            
            if (data[0] === 'ok') {
                console.log('Remote signals ok');
                sandboxedGps.request('wish.identity.export', [peer, peer.ruid], function(err, data) {
                    //console.log('exported remote identity:', err, data);
                    
                    lsignals = mist1.request('signals', [], function(err, data) {
                        //console.log('lsignals:', err, data);
                        if (data[1] && data[1].hint === 'permission') {
                            mist1.request('sandbox.allowRequest', [data[1].id, data[1].opts], function(err, data) {
                                console.log('Allow request:', err, data);
                                //mist1.requestCancel(lsignals);
                                sandboxedGps.request('listPeers', [], (err, data) => {
                                   console.log("listPeers", data);
                                   
                                });
                            });
                        }
                        
                        if (data[0] === 'connections') {
                            console.log("Connections signal on mist1")
                            mist1.wish.request('connections.list', [], function (err, data) {
                                if (!data[0]) {
                                    done(new Error("unexpected: no connection"));
                                }

                                var found = false;
                                for (var x in data) {
                                    var connection = data[0];
                                    if (Buffer.compare(connection.ruid, peer.ruid) === 0 && Buffer.compare(connection.luid, mistIdentity1.uid) === 0 && !connection.friendRequest) {
                                        console.log("Connections are expected, num connections:", data.length)
                                        found = true;
                                        console.log(data);
                                    }

                                }
                                if (!found) {
                                    //console.log(('Connections are not as expected ', data));
                                    //done (new Error('Connections are not as expected ' + inspect(data)));
                                }

                            });
                        }
                    });
                    
                    console.log("Doing wish.identity.friendRequest from sandboxedGps")
                    
                    sandboxedGps.request('wish.identity.friendRequest', [null, peer.luid, data], function(err, data) {
                        console.log('Here you go', err, data.meta);
                        done();
                    });
                });
                
            } else {
                //console.log('signal:', err, data);
            }
        });
    });
});
