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
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
    
    before(function(done) {
        console.log('before 2');
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        app2.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        util.clear(app1, done);
    });

    before(function(done) {
        util.clear(app2, done);
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
        node = new MistNode({ name: 'ControlThings', corePort: 9096 });
        node.create({
            state: { label: 'State', type: 'bool', read: true, write: true } 
        });
        
        node.write(function(epid, data) {
            console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 100);
        
    });

    var app2hid;
    var app2sid;

    before(function(done) {
        app2.request('host.config', [], function(err, data) {
            console.log('app2: host.config', err, data);
            app2hid = data.hid;
            done();
        });
    });

    before(function(done) {
        mist2.request('getServiceId', [], function(err, data) {
            console.log('app2: sid', err, data.wsid);
            app2sid = data.wsid;
            done();
        });
    });

    var app2serviceCert;

    before(function(done) {
        app2.request('identity.export', [mistIdentity2.uid], function(err, data) {
            console.log('exported:', err, data);
            var cert = BSON.deserialize(data.data);
            cert.hid = app2hid;
            cert.sid = app2sid;
            cert.protocol = 'ucp';
            
            data.data = BSON.serialize(cert);
            
            app2.request('identity.sign', [mistIdentity2.uid, data], function(err, data) {
                console.log("the cert we publish:", err, data);
                app2serviceCert = data;
                done();
            });
        });
    });
    
    before(function(done) {
        mist2.wish('identity.list', [], function(err, data) {
            console.log('services.list', err, data);
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
            console.log("Signal from MistApi", err, inspect(data, null, 10, true));
            if(data[0] && data[0] === 'sandboxed.settings') {
                requestToBeAccepted = data[1];
                done();
                mist1.requestCancel(signals);
            }
        });

        sandboxedGps = new Sandboxed(mist1, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            sandboxedGps.request('wish.identity.list', [], function(err, data) {
                console.log('Sandbox sees these identities:', err, data);
                
                if (data[0]) {
                    var uid = data[0].uid;
                    
                    
                    
                    //var cert = BSON.serialize({ data: BSON.serialize({ alias: 'Mr Someone', uid: new Buffer(32), pubkey: new Buffer(32), hid: new Buffer(32), sid: new Buffer(32), protocol: 'ucp' }), meta: new Buffer(16), signatures: [] });
                    var cert = app2serviceCert;
                    
                    console.log('sending request from sandbox', [uid, cert]);
                    
                    sandboxedGps.request('wish.identity.friendRequest', [uid, cert], function(err, data) {
                        console.log('Sandbox got response for wish.identity.friendRequest', err, data);
                    });
                }
            });
            
        });
    });
    
    it('should accept the request from sandbox', function(done) {
        // 'sandbox.addPeer'
        
        var signals = app2.request('signals', [], function(err, data) {
            console.log('app2 signals:', err, data);
            if (data[0] === 'friendRequest')  {
                app2.cancel(signals);
                done();
            }
        });
        
        mist1.request('sandbox.allowRequest', [requestToBeAccepted.id, requestToBeAccepted.hint], function(err, data) {
            console.log('sandbox.allowRequest response:', err, data);
            //done();
        });
    });
    
    it('should accept friend request and see peer in sandbox', function(done) {
        var signals = sandboxedGps.request('signals', [], function(err, data) {
            if (data === 'peers' || data[0] === 'peers') {
                sandboxedGps.request('listPeers', [], function(err, data) {
                    if (data.length !== 1) { return done(new Error('Not exactly one peer in sandbox!')); }
                    
                    var peerCert = BSON.deserialize(app2serviceCert.data);
                    
                    if ( Buffer.compare(data[0].luid, mistIdentity1.uid) !== 0 ) { return done(new Error('Sandbox peer luid incorrect!')); }
                    if ( Buffer.compare(data[0].ruid, peerCert.uid) !== 0 ) { return done(new Error('Sandbox peer ruid incorrect!')); }
                    if ( Buffer.compare(data[0].rhid, peerCert.hid) !== 0 ) { return done(new Error('Sandbox peer rhid incorrect!')); }
                    if ( Buffer.compare(data[0].rsid, peerCert.sid) !== 0 ) { return done(new Error('Sandbox peer rsid incorrect!')); }
                    
                    sandboxedGps.requestCancel(signals);
                    done();
                });
            }
        });

        
        app2.request('identity.friendRequestList', [], function(err, data) {
            console.log('app2 friendRequestList:', err, data);
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list!'));
            }

            app2.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                console.log('app2 friendRequestAccept:', err, data);
            });
        });        
    });
});