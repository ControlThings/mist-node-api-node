var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

/** 
 * The purpose of this test is to verify that if there are two distict peers, that both do control.follow on one and same mist instance, 
 * then the cancelling of the one peer does not interfere with the other peer's control.follow!
 */
describe('Wish RPC server, not mixing up rpc cancels', function () {
    var mistIdentity;
    var app1;

    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });

    before(function(done) {
        util.clear(app1, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity = identity;
            done(); 
        });
    });
    
    var peer;
    var end = false;
    var node;
    var enabled = true;

    var currentCounterValue = 0;

    

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.addEndpoint('mist', { type: 'string' });
        node.addEndpoint('mist.name', { label: 'Name', type: 'string', read: true, write: true });
 
        node.addEndpoint('counter', { label: 'Counter', type: 'int', read: true, write: true });
    

        var name = 'Just a Name';
        
        node.read('mist.name', function(args, peer, cb) { cb(null, name); });
        
        node.read('counter', function(args, peer, cb) { 
            
            cb(null, currentCounterValue); 

        
        });
        
        
        setTimeout(done, 200);


        setInterval(() => {
            currentCounterValue++;
            node.changed('counter');    
        }, 1000);

    });  

    var node1;
    var peer1;
    
    before('should start mist node 1', function (done) {
        node1 = new MistNode({ name: 'FollowTester1', corePort: 9095 }); // , coreIp: '127.0.0.1'
        node1.on('ready', function() {
            
        });
        node1.on('online', function (peer) {
            if ( Buffer.compare(peer.luid, mistIdentity.uid) == 0) {
                node1.request(peer, "control.read", ["mist.name"], function (err, data) {
                    if (!err) {
                        peer1 = peer;
                        done();
                        
                        done = function() { };
                    }
                });
                
            }
        });
    });

    var node2;
    var peer2;
    before('should start mist node 2', function (done) {
        node2 = new MistNode({ name: 'FollowTester2', corePort: 9095 }); // , coreIp: '127.0.0.1'
        node2.on('ready', function() {
            
        });
        node2.on('online', function (peer) {
            if ( Buffer.compare(peer.luid, mistIdentity.uid) == 0) {
                node2.request(peer, "control.read", ["mist.name"], function (err, data) {
                    if (!err) {
                        peer2 = peer;
                        done();
                        done = function() { };
                    }
                });
            }
        });
    });

    /* Now test if app/mist RPC server on 'node' can distinguish between control.follow requests node1 and node2, node1 and node2 both assign the same id to their requests! */ 
    it('Both MistNodes start control.follow (node1 first, then node2), then node2 cancels, node1 should still get updates...', function(done) {
        this.timeout(3*1000);
        var localCounter = 0;

        var startCounting = false;
            
        const followId1 = node1.request(peer1, 'control.follow', [], function (err, data) {
            console.log("node1 control.follow", err, data, "id", followId1);
            if (err && !data.end) { console.log("node1 ___ERROR____", data); return done(new Error(data.msg)); }

            if (data.id === 'counter') {
                if (startCounting && data.data > 0) {
                    
                    done();
                    done = function() { };
                }
                
            }
        });
        const followId2 = node2.request(peer2, 'control.follow', [], function (err, data) {
            console.log("node2 control.follow", err, data, "id", followId2);
            if (err && !data.end) { console.log("node2 ___ERROR____", data); return done(new Error(data.msg)); }

            if (data.id === 'counter') {
                /* Now that node2's control.follow callback gets first invocation, it cancels the request.
                The rightful assumption is that it does not interfere with node1's follow... but wow it does, at the time of writing of this test!
                The reason is that both get id 1 locally, the remote app mist rpc server registers the ids, and does the cancelling only by id, not id AND peer! */
                node2.requestCancel(followId2);
                startCounting = true;
            }
        });
        
        if (followId1 !== followId2) {
            done(new Error("node1's and node2's control.follow RPC ids are not equal, which defeats the purpose of this test!"));
        }
            
        
    });

    // Do the same test on wish app, and see if it does the same! (no it does not, Wish core's app RPC server can distinguish between callers!)
    it('Both MistNodes start wish signals (node1 first, then node2), then node2 cancels, node1 should still get updates...', function(done) {
        this.timeout(5*1000);
        var localCounter = 0;

        var startCounting = false;
            
        const signalsId1 = node1.wish.request('signals', [], function (err, data) {
            console.log("node1 wish signals", err, data, "id", signalsId1);
            if (err && !data.end) { console.log("node1 wish signals ___ERROR____", data); return done(new Error(data.msg)); }

            if (data[0] === 'identity') {
                if (startCounting) {
                    done();
                    done = function() { };
                }
                
            }
        });
        const signalsId2 = node2.wish.request('signals', [], function (err, data) {
            console.log("node2 wish signals", err, data, "id", signalsId2);
            if (err && !data.end) { console.log("node2 wish signals ___ERROR____", data); return done(new Error(data.msg)); }

            if (data[0] === 'identity') {
                node2.wish.cancel(signalsId2);
                startCounting = true;
                
            }
        });
        
        /* Now start changing repeatedly the local identity name, to get wish 'identity' signals. */
        setInterval(() => {
            localCounter++;
            node2.wish.request('identity.update', [mistIdentity.uid, { alias: "foo"+localCounter }], function (err, data) {
                if (err && !data.end) { console.log("___ERROR____", data); return done(new Error(data.msg)); }

                console.log("Update");
            });
        }, 1000);
            
        if (signalsId1 !== signalsId2) {
            done(new Error("node1's and node2's wish signals RPC ids are not equal, which defeats the purpose of this test!"));
        }
    });

});