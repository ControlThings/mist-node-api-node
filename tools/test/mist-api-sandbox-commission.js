var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

var bson = require('bson-buffer');
var BSON = new bson();

describe('MistApi Sandbox', function () {
    var mist;
    var bobMist;
    
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

    before(function(done) {
        var name = "MistConfig";
        var node = new MistNode({ name: name, corePort: 9096 }); // , coreIp: '127.0.0.1', corePort: 9094
        //this.node = node;

        // add `mist` endpoint
        node.addEndpoint('mist', { type: 'string' });
        // add `mist.name` as subendpoint to mist
        node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { console.log('MistConfig mist.name read:', name); cb(null, name); } });
        
        node.addEndpoint("mistVersion", { type: "string", read: function(args, peer, cb) {
            console.log("mistVersion");
            cb(null, "1.0.1");
        }});
    
        node.addEndpoint("mistWifiListAvailable", { invoke: function(args, peer, cb) {
            cb(null, [{ ssid: '106 Broad Street', rssi: -10 }, { ssid: '21 Water Street', rssi: -31 }]);
        }});
    
        node.addEndpoint("mistWifiCommissioning", { invoke: function(args, peer, cb) {
            node.wish.request('connections.disconnectAll', [], (err, data) => {
                console.log('disconnectAll after mistWifiCommissioning cb:', err, data);
            });            
            //cb(null, true);
        }});
        
        node.addEndpoint("claimCore", { invoke: function(args, peer, cb) {
            //console.log("mistVersion");
            node.wish.request('identity.permissions', [peer.ruid, {core:{owner:true}}], (err, data) => {
                console.log('identity.permissions', data);
                node.wish.request('host.skipConnectionAcl', [false], (err, data) => {
                    console.log('host.skipConnectionAcl', data);
                    cb(null, "1.0.1");
                });
            });
        }});
    
        done();
    });

    before(function(done) {
        var name = "TestNode";
        var node = new MistNode({ name: name, corePort: 9096 }); // , coreIp: '127.0.0.1', corePort: 9094
        //this.node = node;

        // add `mist` endpoint
        node.addEndpoint('mist', { type: 'string' });
        // add `mist.name` as subendpoint to mist
        node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { console.log('read mist.name called:', name); cb(null, name); } });
        
        node.addEndpoint("mistVersion", { type: "string", read: function(args, peer, cb) {
            console.log("mistVersion");
            cb(null, "1.0.1");
        }});
    
        node.addEndpoint("battery", { invoke: function(args, peer, cb) {
            cb(null, { level: 7.1, state: 'discharging' });
        }});
    
        done();
    });
    
    before(function(done) {
        console.log('before 2');
    
        bobApp = new WishApp({ name: 'BobTester', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        bobApp.once('ready', function() {
            done();
            
            bobApp.request("identity.friendRequestList", [], (err, data) => {
                for (var i in data) {
                    bobApp.request("identity.friendRequestDecline", [data[i].luid, data[i].ruid], (err, data) => {});
                }
            });

            bobApp.request("signals", [], (err, data) => {
                if (data[0] === "friendRequest") {
                    console.log("friendRequest");
                    bobApp.request("identity.friendRequestList", [], (err, data) => {
                        var ruid = data[0].ruid;

                        bobApp.request("identity.friendRequestAccept", [data[0].luid, data[0].ruid], (err, data) => {
                            console.log("identity.friendRequestAccept cb ", err, data);
                        });
                    });
                }
            })
        });
    });
    
    
    
    
    
    
    
    before('Setup Generic UI', function (done) {
        bobMist = new Mist({ name: 'Generic UI', corePort: 9096 });

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
    
    before('clear 1', function(done) {
        util.clear(mist, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }
            done(); 
        });
    });
    
    before(function(done) {
        util.clear(bobApp, done);
    });
    
    before('ensure 1', function(done) {
        util.ensureIdentity(mist, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });

    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(bobApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    
    it('should list sandboxes', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            console.log("sandbox.list", err, data);
            done();
        });
    });
    
    it('should list wish identities', function(done) {
        mist.wish.request('identity.list', [], function(err, data) {
            console.log("all identities", err, data);
            done();
        });
    });

    var sandboxedGps;

    it('should add peer to gps sandbox', function(done) {
        
        sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        
        console.log('Sandbox login goes here:', gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);
            done();
        });
    });

    it('should get commission.list ', function(done) {
        mist.request('commission.add', ['wifi', 'mist-315 S. Broad St.'], function(err, data) {
            if (err) { return done(new Error('Could not get list.')); }
            
            console.log("Commission.list result: ", err, data);
            done();
        });
    });
    
    it('should get commission.list ', function(done) {
        sandboxedGps.request('commission.list', [], function(err, data) {
            if (err) { return done(new Error('Could not get list.')); }
            
            console.log("Commission.list result: ", err, data);
            done();
        });
    });
    
    it('should set skipConnectionAcl ', function(done) {
        bobApp.request('host.skipConnectionAcl', [true], function(err, data) {
            //if (err) { return done(new Error('Could not set skipConnectionAcl.')); }
            
            console.log("host.skipConnectionAcl cb: ", err, data);
            done();
        });
    });

    it('should commission.perform with wifi', function(done) {
        this.timeout(15000);
        var timeout;

        var log = [];
        
        var luid = mistIdentity1.uid;
        
        sandboxedGps.request('commission.perform', [luid, { type: 'wifi', ssid: 'mist-somenetwork', class: 'fi.ct.test' }], function(err, data) {
            log.push(data);
            if (err) { console.log('an error:', err, data, log); return done(new Error(data.msg)); }
            
            if(data[0] && data[0] === 'wifiListAvailable') {
                // [ 'wifiListAvailable',
                //   [ { ssid: '106 Broad Street', rssi: -10 },
                //     { ssid: '21 Water Street', rssi: -31 } ] ] 
               
                // got a signal that there are wifis available to commission the device to
                //console.log('wifiListAvailable data', data);
                var ssid = data[1][0].ssid;
                var password = 'TheUltimateSecret';
                
                sandboxedGps.request('commission.selectWifi', [ssid, password], (err, data) => {
                    console.log('Your wifi selection cb', err, data);
                });
            } else if ( data === 'COMMISSION_STATE_FINISHED_OK') {
                console.log('commission.perform log:', log);
                done();
            } else if ( data === 'COMMISSION_STATE_WAIT_FOR_PEERS') {
                //timeout = setInterval(() => {
                //    bobApp.request('connections.list', [], (err, data) => {
                //        console.log('connections.list cb', err, data);
                //    });
                //}, 1000);
            }
            
            console.log("Commission.perform result: ", err, data);
        });
    });

    //it('should wait for wld', function(done) { this.timeout(5200); setTimeout(done, 5000); });

    it('should set skipConnectionAcl ', function(done) {
        console.log('wish: identity.remove...');
        mist.wish.request('identity.remove', [mistIdentity2.uid], function(err, data) {
            //if (err) { return done(new Error('Could not set skipConnectionAcl.')); }

            console.log("identity.remove cb: ", err, data);
            bobApp.request('host.skipConnectionAcl', [true], function(err, data) {
                //if (err) { return done(new Error('Could not set skipConnectionAcl.')); }

                console.log("host.skipConnectionAcl cb: ", err, data);
                done();
            });
        });
    });

    it('should commission.perform with local (discovery)', function(done) {
        this.timeout(15000);
        var log = [];
        
        var luid = mistIdentity1.uid;
        
        sandboxedGps.request('commission.list', [], function(err, data) {
            if (err) { console.log('an error:', err, data); return done(new Error('Could not get list.')); }

            console.log('list', data);
            
            var item = null;
            
            for(var i in data) {
                if (data[i].type === 'local' 
                        && data[i].claim 
                        && data[i].class === 'fi.ct.test' 
                        && Buffer.compare(data[i].ruid, luid) !== 0 )
                {
                    item = data[i];
                    break;
                }
            }
            
            if (!item) { return done(new Error('Failed finding item to commission.')); }
            
            console.log('Starting wld commissing with:', item);
            
            sandboxedGps.request('commission.perform', [luid, item], function(err, data) {
                log.push(data);
                
                if (err) { console.log('an error:', err, data, log); return done(new Error('Could not get list.')); }
                

                console.log("Commission.perform result: ", err, data);
                
                if ( data === 'COMMISSION_STATE_FINISHED_OK') {
                    sandboxedGps.request('listPeers', [], (err, data) => {
                        console.log('listpeers', err,data);
                        console.log('commission.perform log:', log);
                        done();
                    });
                }
            });
        });
    });
});
