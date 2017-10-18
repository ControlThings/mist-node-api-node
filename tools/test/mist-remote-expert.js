var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var srcApp;
var dstApp;
var requestorApp;

var aliceIdentity;
var bobIdentity;
var charlieIdentity;

var bobWldEntry;
var charlieWldEntry;

/*
 * Test for mappings between three cores. 
 * 
 * This test expects the test suite to have three cores, at app ports at 9095, 9096 and 9097.
 * 
 * The test ensures identities Alice, Bob, Charlie. Alice is making the requestMapping, Bob is the source of the mapping and Charlie is the destination.
 * 
 * @returns {undefined}
 */

describe('Mist Invite', function () {
    var requestorMist;
    var expertMist;

    before(function(done) {
        requestorApp = new WishApp({ name: 'control app', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
   
    before(function(done) {
        srcApp = new WishApp({ name: 'app1', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        srcApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        dstApp = new WishApp({ name: 'app2', protocols: ['test'], corePort: 9097 }); // , protocols: [] });

        dstApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        util.clear(requestorApp, done);
    });
    
    before(function(done) {
        util.clear(srcApp, done);
    });
    
    before(function(done) {
        util.clear(dstApp, done);
    });

    var name1 = 'Alice'; // Alice is the one who requests the mapping
    
    before(function(done) {
        util.ensureIdentity(requestorApp, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob'; // Bob is the source for the mapping
    
    before(function(done) {
        util.ensureIdentity(srcApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            done(); 
        });
    });
    
    var name3 = 'Charlie'; //Charlie is destination for the mapping
    before(function(done) {
        util.ensureIdentity(dstApp, name3, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            charlieIdentity = identity;
            done(); 
        });
    });

    before('import mistIdentity2', function(done) {
        console.log('app1.import(mistIdentity2)');
        requestorApp.request('identity.import', [BSON.serialize(bobIdentity)], function(err, data) {
            done();
        });
    });
    
    before('import mistIdentity1', function(done) {
        srcApp.request('identity.import', [BSON.serialize(aliceIdentity)], function(err, data) {
            done();
        });
    });
    
    before(function(done) {
        // wait for relay connections to init
        setTimeout(function(){ done(); },200);
    });
    
    
    before(function (done) {
        requestorMist = new Mist({ name: 'Requestor Mist', corePort: 9095 });

        setTimeout(function() {
            requestorMist.request('ready', [], function(err, ready) {
                if (ready) {
                    requestorMist.request('signals', [], function(err, data) {
                        if (err) { console.log("err: ", err); return; }
                    });
                    done();
                } else {
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });

    var nodeName = 'src Node';

    var nodeSid = Buffer.alloc(32, 0);
    nodeSid.write(nodeName);
    
    before(function(done) {
        node = new MistNode({ name: nodeName, corePort: 9096 });
        node.create({
            output: { label: 'output', type: 'bool', read: true, write: true },
            broken: { label: 'Device is broken', type: 'bool', read: true, write: true } 
        });
        
        node.write('output', function(value, peer, cb) {
            console.log(nodeName +' write "output":', value);
            cb();
        });
        
        node.write('broken', function(value, peer, cb) {
            console.log(nodeName +' write "broken":', value);
            cb();
        });
        
        setTimeout(done, 100);
        
    });

    
    before('Start Expert Mist', function (done) {
        expertMist = new Mist({ name: 'Expert Mist', corePort: 9097 });

        /*
        setTimeout(function() {
            console.log('start expert ready call..');
            expertMist.request('ready', [], function(err, ready) {
                console.log('start expert ready response..', err, ready);
                if (ready) {
                    expertMist.request('signals', [], function(err, data) {
                        if (err) { console.log("err: ", err); return; }
                    });
                    done();
                } else {
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
        */
        done();
    });
    
    var connection;
    
    before('should have connection between alice and bob', function(done) {
        this.timeout(5000);
        
        var signals = requestorApp.request('signals', [], function(err, data) {
            console.log('requestorApp signals waiting for connections:', err, data);
            if (data[0] === 'connections') {
                requestorApp.request('connections.list', [], function(err, data) {
                    for (var i in data) {
                        if ( Buffer.compare(data[i].luid, aliceIdentity.uid) === 0 
                            && Buffer.compare(data[i].ruid, bobIdentity.uid) === 0 )
                        {
                            requestorApp.cancel(signals);
                            connection = data[i];
                            done();
                            done = function() {};
                        }
                    }
                });
            }
        });
    });
    
    var peer;
    
    it('should find the peer', function(done) {
        function peers(err, data) {
            for(var i in data) {
                console.log('peer:', data[i].rsid);
                
                if ( Buffer.compare(new Buffer('ControlThings'), data[i].rsid.slice(13)) ) {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); return; }

                    peer = data[0];
                    //console.log("The peers is:", peer);
                    requestorMist.requestCancel(signals);
                    done();
                    done = function() {};
                    
                    break;
                }
            }
        }
        
        var signals = requestorMist.request('signals', [], function(err, signal) { 
            //console.log('signal:', err, signal);
            
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                requestorMist.request('listPeers', [], peers);
            }
        });
        
        requestorMist.request('listPeers', [], peers);
    });
    
    var friendRequestMeta;
    
    it('should remotely export identity of bob', function(done) {
        requestorApp.request('connections.request', [connection, 'identity.export', [connection.ruid]], function(err, data) {
            //console.log('bob identity exported:', err, data);
            var cert = BSON.deserialize(data.data);
            cert.hid = connection.rhid;
            cert.sid = peer.rsid;
            data.data = BSON.serialize(cert);
            requestorApp.request('connections.request', [connection, 'identity.sign', [connection.ruid, data]], function(err, data) {
                //console.log('remote sign:', err, data);
                friendRequestMeta = data;
                done();
            });
        });
    });
    
    var expert;
    
    it('should get the expert', function(done) {
        dstApp.request('identity.export', [charlieIdentity.uid], function(err, data) {
            expert = data;
            done();
        });
    });
    
    it('should invite the expert', function(done) {
        var signals = dstApp.request('signals', [], function(err, data) {
            if (data[0] === 'friendRequest') {
                console.log('signal in expert', data);
                dstApp.request('identity.friendRequestList', [], function(err, data) {
                    dstApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                        dstApp.cancel(signals);
                        done();
                    });
                });
            }
        });
        
        requestorApp.request('identity.friendRequest', [aliceIdentity.uid, expert, friendRequestMeta], function(err, data) {
            console.log('Invite response:', err, data);
        });
    });

    it('should have expert befriending the device', function(done) {
        dstApp.request('wld.list', [], function(err, data) {
            //console.log('wld.list', data);
            
            for (var i in data) {
                if (data[i].type === 'friendReq') {
                    var signals = srcApp.request('signals', [], function(err, data) {
                        console.log('device signals', err, data);
                        if (data[0] === 'friendRequest') {
                            srcApp.request('identity.friendRequestList', [], function(err, data) {
                                srcApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function(err, data) {
                                    done();
                                    srcApp.cancel(signals);
                                });
                            });
                        }
                    });
                    dstApp.request('wld.friendRequest', [charlieIdentity.uid, data[i].ruid, data[i].rhid], function(err, data) {
                        //done();
                    });
                }
            }
        });
    });
    
    var expertsPeer;
    
    it('should have expert wait for a peer', function(done) {
        this.timeout(7000);
        
        function checkPeers() {
            expertMist.request('listPeers', [], function(err, data) {
                for (var i in data) {
                    if( Buffer.compare(data[i].rsid, nodeSid) === 0 ) {
                        expertsPeer = data[i];
                        done();
                        done = function() {};
                        return;
                    }
                }
            });
        }
        
        expertMist.request('signals', [], function(err, data) {
            if (data[0] === 'peers') {
                checkPeers();
            }
        });
        
        checkPeers();
    });
    
    it('should have expert sending a command to device', function(done) {
        expertMist.request('mist.control.model', [expertsPeer], function(err, data) {
            if (!data.broken) {
                return done(new Error('The device responded with something unexpected'));
            }
            
            done();
        });
    });
});