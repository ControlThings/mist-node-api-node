/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
var Mist = require('../../index.js').Mist;
var WishApp = require('../../index.js').WishApp;
var Sandboxed = require('../../index.js').Sandboxed;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

var bson = require('bson-buffer');
var BSON = new bson();

describe('MistApi Sandbox', function () {
    var mist;
    var wishApp;
    
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

    before('Setup Generic UI Wish App', function (done) {
        wishApp = new WishApp({ name: 'Generic UI Wish App', corePort: 9095 });

        setTimeout(function() {
            wishApp.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    done(new Error('WishApp not ready, bailing.'));
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
    
    before('clear 1', function(done) {
        util.clear(mist, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }
            done(); 
        });
    });
    
    before('ensure 1', function(done) {
        util.ensureIdentity(mist, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');

    var node;
    var enabled = false;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9096 });

        node.addEndpoint('mist', { type: 'string' });
        node.addEndpoint('mist.name', { label: 'Name', type: 'string', read: true, write: true });
        node.addEndpoint('name', { label: 'Name', type: 'string', read: true, write: true });
        node.addEndpoint('enabled', { label: 'Enabled', type: 'bool', read: true, write: true });
        node.addEndpoint('lon', { label: 'Longitude', type: 'float', read: true });
        node.addEndpoint('counter', { label: 'Counter', type: 'int', read: true, write: true });
        node.addEndpoint('config', {
            label: 'Config',
            invoke: function(args, peer, cb) {
                cb(null, { cool: ['a', 7, true], echo: args });
            }
        });
        
        var name = 'Just a Name';
        var counter = 56784;
        
        node.read('mist.name', function(args, peer, cb) { cb(null, name); });
        
        node.read('name', function(args, peer, cb) { cb(null, 'root:'+ name); });
        
        node.read('enabled', function(args, peer, cb) { cb(null, enabled); });
        
        node.read('lon', function(args, peer, cb) { cb(null, 63.4); });
        
        node.read('counter', function(args, peer, cb) { cb(null, counter); });
        
        node.invoke('device.config', function(args, peer, cb) {
            cb(null, { cool: ['a', 7, true], echo: args });
        });
        
        node.write('enabled', function(value, peer, cb) {
            //console.log('Node write:', epid, peer, data);
            cb(null);
        });
        
        node.write('mist.name', function(value, peer, cb) {
            //console.log('writing mist.name to', value);
            name = value;
            node.changed('mist.name');
            cb(null);
        });
        
        setInterval(() => { counter++; node.changed('counter'); }, 500);
        
        setTimeout(done, 200);
    });      
    
    before(function(done) {
        util.clear(node, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before('ensure identity '+name2, function(done) {
        util.ensureIdentity(node, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    
    before('import identity 1', function(done) {
        mist.wish.request('identity.import', [BSON.serialize(mistIdentity2)], function(err, data) {
            //console.log('Identity import said 1:', err, data);
            done();
        });
    });
    
    before('import identity 2', function(done) {
        node.wish.request('identity.import', [BSON.serialize(mistIdentity1)], function(err, data) {
            //console.log('Identity import said 2:', err, data);
            done();
        });
    });
    
    before('should find the remote peer', function(done) {
        this.timeout(5000);
        //console.log('Testing peer');
        
        mist.request('signals', [], function(err, data) {
            //console.log('mist signals:', err, data);
            if (data[0] === 'peers') {
                done();
                done = function() {};
            }
        });
        
    });
    
    var peer;

    before('should find a peer', function(done) {
        mist.request('listPeers', [], function(err, data) {
            //console.log("mist.listPeers", err, data);
            
            var list = [];
            
            for (var i in data) {
                if( Buffer.compare(data[i].luid, mistIdentity1.uid) === 0 ) {
                    list.push(data[i]);
                }
            }
            
            if(list.length>0) {
                peer = list[0];
                //console.log("Here is alice and the peer we added:", mistIdentity1, peer);
                done();
            } else {
                //console.log('mistIdentity1 & 2', mistIdentity1, mistIdentity2);
                done(new Error('No peer found!'));
            }
        });
    });
    
    it('should list sandboxes', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            //console.log("sandbox.list", err, data);
            done();
        });
    });
    
    it('should list wish identities', function(done) {
        mist.wish.request('identity.list', [], function(err, data) {
            //console.log("all identities", err, data);
            done();
        });
    });

    var sandboxedGps;

    it('should add peer to gps sandbox', function(done) {
        
        sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        
        //console.log('Sandbox login goes here:', gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("Sandbox login reponse:", err, data);
            mist.request('sandbox.addPeer', [gpsSandboxId, peer], function(err, data) {
                //console.log("addPeer response for gpsSandbox", err, data);

                var bogusPeer = { luid: peer.luid, ruid: mistIdentity2.uid, rhid: peer.rhid, rsid: peer.rsid, protocol: peer.protocol, online: false };

                mist.request('sandbox.addPeer', [gpsSandboxId, bogusPeer], function(err, data) {
                    //console.log("addPeer response for gpsSandbox", err, data);
                    mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
                        console.log("peers allowed for gpsSandbox", err, data);
                        done();
                    });
                });
            });
        });
    });

    it('should test sandbox', function(done) {

        mist.request('signals', [], function(err, data) {
            //console.log("Signal from MistApi", err, data);
        });

        sandboxedGps = new Sandboxed(mist, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("Sandbox login reponse:", err, data);

            var ended = false;

            sandboxedGps.request('signals', [], function(err, data) {
                //console.log("sandboxedGps signals:", err, data);
                
                if (data[0] === 'ready') {
                    sandboxedGps.request('listPeers', [], function(err, data) {
                        //console.log("sandboxedGps listPeers:", err, data);
                        
                        for(var i in data) {
                            if(!data[i].online) { continue; }
                            sandboxedGps.request('mist.control.model', [data[i], 'enabled'], function(err, data) {
                                //console.log("sandboxedGps model:", err, data);
                                if(!ended) { ended = true; done(); }
                            });
                        }
                    });
                }
                
            });
        });
    });
    
    it('should list peers for gps sandbox', function(done) {
        mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
            //console.log("peers allowed for gpsSandbox", err, data);
            done();
        });
    });
    
    it('should list identities in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('wish.identity.list', [null], function(err, data) {
                //console.log("sandboxed: identity.list:", err, data);
                console.log('Warning no checks!');
                done();
            });
        });
    });
    
    it('should update remote identity alias in remote core from sandbox', function(done) {
        
        //console.log('About to make wish.identity.update...');
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('listPeers', [], function(err, data) {
                //console.log("sandboxedGps listPeers:", err, data);

                /*
                sandboxedGps.request('wish.identity.permissions', [data[0], mistIdentity2.uid, { admin: true }], function(err, data) {
                    console.log("Remote: wish.identity.permissions:", err, data);
                    if (data.permissions.admin !== true) {
                        return done(new Error('Permission not set, expecting "permissions.admin": true, response was: '+inspect(data))) 
                    }
                    
                    done();
                });
                */
               done();
            });
        });
    });
    
    it('should update remote identity alias in remote core from sandbox', function(done) {
        
        //console.log('About to make wish.identity.update...');
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('listPeers', [], function(err, data) {
                //console.log("sandboxedGps listPeers:", err, data);

                sandboxedGps.request('wish.identity.update', [data[0], mistIdentity2.uid, { alias: 'Alvin M. Weinberg', role: 'technician', phone: '+358401231234' }], function(err, data) {
                    //console.log("Remote: wish.identity.update:", err, data);
                    console.log('Warning no checks!');
                    done();
                });
            });
        });
    });
    
    it('should update local identity alias', function(done) {
        
        //console.log('About to make wish.identity.update...');
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('wish.identity.update', [null, mistIdentity2.uid, { alias: 'Albert E.', role: 'user' }], function(err, data) {
                //console.log("Remote: wish.identity.update:", err, data);
                console.log('Warning no checks!');
                done();
            });
        });
    });
    
    it('should list identities from remote core in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('listPeers', [], function(err, data) {
                //console.log("sandboxedGps listPeers:", err, data);

                sandboxedGps.request('wish.identity.list', [data[0]], function(err, data) {
                    //console.log("sandboxed remote identities:", err, data);
                    console.log('Warning no checks!');
                    done();
                });
            });
        });
    });
    
    it('should export identity from remote core from sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedGps.request('listPeers', [], function(err, data) {
                //console.log("sandboxedGps listPeers:", err, data[0], data[0].ruid);

                sandboxedGps.request('wish.identity.export', [data[0], data[0].ruid], function(err, data) {
                    //console.log("sandboxed remote identity.export:", err, data);
                    console.log('Warning no checks!');
                    done();
                });
            });
        });
    });
    
    var signed;
    
    it('should sign document in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);
            sandboxedGps.request('wish.identity.sign', [null, mistIdentity1.uid, { data: BSON.serialize({ msg: 'sandboxed signature' }) }], function(err, data) {
                //console.log("ControlThings sandbox signature:", err, data);
                if (!data.data) { return done(new Error('No data-field in response.')); }
                if (!data.signatures) { return done(new Error('No signaures-field in response.')); }
                if (!data.signatures[0]) { return done(new Error('No signaure[0]-field in response.')); }
                if (!data.signatures[0].sign) { return done(new Error('No signaure[0].sign-field in response.')); }
                
                signed = data;
                
                done();
            });
        });
    });

    it('should verify document in sandbox', function(done) {
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            //console.log("ControlThings Sandbox login reponse:", err, data);
            sandboxedGps.request('wish.identity.verify', [null, signed], function(err, data) {
                //console.log("ControlThings sandbox signature verification:", err, data);
                if (!data.data) { return done(new Error('No data-field in response.')); }
                if (!data.signatures) { return done(new Error('No signaures-field in response.')); }
                if (!data.signatures[0]) { return done(new Error('No signaure[0]-field in response.')); }
                if (!data.signatures[0].sign) { return done(new Error('No signaure[0].sign-field in response.')); }
                
                done();
            });
        });
    });

    it('should control.follow and cancel ', function(done) {
        var cancel = true;
        
        var req = sandboxedGps.request('mist.control.follow', [peer], function(err, data) {
            if (err) {
                if (data.end) { return done(); }
                if (data.timeout) { return done(); }
                return done(new Error('Unexpected error with control.follow')); 
            }
        
            if (cancel) {
                //console.log('control.follow', err, data, req);
                sandboxedGps.requestCancel(req);
                cancel = false;
            }
        });
    });

    
    it('should get listPeers ', function(done) {
        sandboxedGps.request('listPeers', [], function(err, data) {
            if (err) { return done(new Error('Could not get list.')); }
            
            console.log("listPeers result: ", err, data);
            done();
        });
    });
    
    it('remove identity via WishApp request, it should disappear from sandbox too', function(done) {
        wishApp.request('identity.remove', [mistIdentity2.uid], (err, data) => {
            console.log("identity.remove", err, data);
            if (err) { return done(new Error('Could not remove mistIdentity2')); }
            
            //done();
            sandboxedGps.request('listPeers', [], function (err, data) {
                if (err) { return done(new Error('Could not listPeers')); }
                
                for (var i in data) {
                    if (Buffer.compare(data[i].ruid, mistIdentity2.uid) == 0) {
                        return done(new Error('Fail, still in the list!'));
                    }
                }
                done();
            });
        });
    });
    
    
});