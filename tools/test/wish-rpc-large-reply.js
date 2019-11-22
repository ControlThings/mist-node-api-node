var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;
const testBlobSize = 130*1024; //MIST_RPC_REPLY_BUF_LEN in mist_app.h must allow this, and of course wish-core-client and the wish core must be able to handle RPC data spanning over multiple TCP transport frames
/**
 * This test will test behaviour of wish-rpc, when very large blobs of data are sent over wish-rpc in reply to a mist control.read.
 * By "very large" we mean blobs of any size that are larger than MIST_RPC_REPLY_BUF_LEN. Also think about the WISH_PORT_RPC_BUFFER_SZ in wish-core
 */
describe('Mist sending a large blob of data over wish-rpc', function () {
    var mist;
    var mistIdentity;
    var app1;

    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);

        app1.on('ready', () =>  {
            app1.request('signals', [], (err, data) => {
                console.log("app1 wish signals", data);

                /* Friend request acceptor for the situation where remote core asks for data */
                if (data && data[0] === 'friendRequest') {
                    app1.request('identity.friendRequestList', [], (err, list) => {
                        //console.log("identity.friendRequestList", list);
                        if (!list[0]) {
                            return;
                        }
                        app1.request('identity.friendRequestAccept', [list[0].luid, list[0].ruid], (err, data) => {
                            //console.log("friendRequestAccept cb", err, data);
                        });
                    });
                }
            });
        });
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
    
    before('start a mist api', function(done) {
        mist = new Mist({ name: 'MistApi', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        setTimeout(done, 200);
    });  
    
    var peer;
    var end = false;
    var node;
    var enabled = true;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.addEndpoint('mist', { type: 'string' });
        node.addEndpoint('mist.name', { label: 'Name', type: 'string', read: true, write: true });
       
        node.addEndpoint('largeDataBlob', { label: 'A large blob of data', type: 'string', read: function(args, peer, cb) { 
                //cb(null, { code: 6, msg: 'Read says no.' }); 
                var largeBuffer = new Buffer(testBlobSize);
                
                cb(null, largeBuffer);
            } 
        });
        
        setTimeout(done, 200);
    });  

    before('should find the peer', function(done) {
        this.timeout(10*1000);
        function peers(err, data) {
            //console.log('==========================', data, mistIdentity);
            for(var i in data) {
                if ( Buffer.compare(data[i].luid, mistIdentity.uid) === 0 
                        && Buffer.compare(data[i].ruid, mistIdentity.uid) === 0 ) 
                {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); return; }

                    peer = data[0];
                    //console.log("The peers is:", peer);
                    done();
                    done = function() {};
                    
                    break;
                }
            }
        }
        
        mist.request('signals', [], function(err, signal) { 
            //console.log('signal:', err, signal);
            
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                mist.request('listPeers', [], peers);
            }
        });
        
        mist.request('listPeers', [], peers);
    });
    
    it('should check identity in core', function (done) {
        node.wish.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error('wish rpc returned error')); }
            //console.log("got the identity list", err, data);
            done();
        });
    });
    
     
    it('shuold test control.read, large reply, service requesting from itself', function(done) {
        //this.timeout(10*1000);
        /* Make a request to an other */
        node.request(peer, "control.read", ["largeDataBlob"], function (err, value) {
            if (err) { return done(new Error(inspect(value))); }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'object' && value.length === testBlobSize) {
                //console.log("Got:", value)
                done();
            } else {
                done(new Error('Value type is unexpected: ' + typeof value));
            }
        });
    });

    
    it('shuold test control.read, large reply from a mist-api app on local core', function(done) {
        //this.timeout(10*1000);
        mist.request('mist.control.read', [peer, 'largeDataBlob'], function (err, value) {
            if (err) { return done(new Error(inspect(value))); }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'object' && value.length === testBlobSize) {
                //console.log("Got:", value)
                done();
            } else {
                done(new Error('Value type is unexpected: ' + typeof value));
            }
        });
    });
    
    var name2 = "Tester number 2";
    var remoteIdentity;
    var app2;
    var mist2;
    var peer2;

    before(function(done) {
        console.log('before 2');
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        setTimeout(done, 200);
    });
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            remoteIdentity = identity;
            done(); 
        });
    });
    
    before('start a mist api this time on other core', function(done) {
        this.timeout(10*1000);
        mist2 = new Mist({ name: 'MistApi tester 2', corePort: 9096 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        

        mist2.request('signals', [], (err, data) => {
            function doWldList() {
                mist2.wish.request("wld.list", [], (err, wldList) => {
                    //console.log("wldList ", wldList);
                    if (!wldList) {
                        
                    }
    
                    for (entry of wldList) {
                        if (Buffer.compare(mistIdentity.uid, entry.ruid) === 0) {
                            mist2.wish.request("wld.friendRequest", [remoteIdentity.uid, entry.ruid, entry.rhid], (err, data) => {
                                console.log("Sent the friend request", err, data);
                                done();
                                done = function() {};
                                doWldList = function() {};
                            });
                        }
                    }
                });
            }

            if (data && data[0]=== 'ready') {
                doWldList();
            }

            if (data && data[0] === 'localDiscovery') {
                doWldList();
            }
            
        });
        
    });  

    before('should find the peer on other core', function(done) {
        this.timeout(10*1000);
        function peers(err, data) {
            //console.log('==========================', data, mistIdentity);
            for(var i in data) {
                //console.log("peers2", data[i].rsid.toString(), Buffer.compare(data[i].luid, remoteIdentity.uid),  Buffer.compare(data[i].ruid, mistIdentity.uid))
                if ( Buffer.compare(data[i].luid, remoteIdentity.uid) === 0 
                        && Buffer.compare(data[i].ruid, mistIdentity.uid) === 0) 
                {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); return; }
                    /* Get model of the peer candidate in order to distinguish it form the other MistApi running on core (port 9095) */
                    ((peerCandidate) => {
                        mist2.request('mist.control.model', [peerCandidate], function (err, model) {
                            //console.log("model:", model);

                            if (model.largeDataBlob) {
                                peer2 = peerCandidate;
                                //console.log("The peers2 is:", peer);
                                done();
                                done = function() {};
                                
                            }
                        });
                    })(data[i]);
                }
            }
        }
        
        mist2.request('signals', [], function(err, signal) { 
            //console.log('signal2:', err, signal);
            
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                mist2.request('listPeers', [], peers);
            }
        });
        
        mist2.request('listPeers', [], peers);
    });

    it('shuold test control.read, large reply from a mist-api app on other core', function(done) {
        //this.timeout(10*1000);
        
        mist2.request('mist.control.read', [peer2, 'largeDataBlob'], function (err, value) {
            if (err) { return done(new Error(inspect(value)));  }
            
            //console.log("Got counter value:", err, value);
            if (typeof value === 'object' && value.length === testBlobSize) {
                //console.log("Got:", value)
                done();
            } else {
                done(new Error('Value type is unexpected: ' + typeof value));
            }
        });
    });
    
   
});