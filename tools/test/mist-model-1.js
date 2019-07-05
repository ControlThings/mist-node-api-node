var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

describe('Mist Model special test 1', function () {
    var mist;
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
    
    before('start a mist api', function(done) {
        mist = new Mist({ name: 'MistApi', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        setTimeout(done, 200);
    });  
    
    var epCount = 0;
    function addEp(node, name) {
        node.addEndpoint(name, { label: 'Endpoint: '+name, type: 'string', read: function(args, peer, cb) { cb(null, name); } });
        epCount++;
    }
    
    var peer;
    var end = false;
    var node;
    var enabled = true;

    before('should start a mist node, last added endpoint is a "child node" (tree.leaf)', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        var name = 'Just a Name';
        
        addEp(node, "test");
        addEp(node, "mist");
        addEp(node, "mist.name");
        addEp(node, "bar");
        addEp(node, "bar.foo");
        
        setTimeout(done, 200);
    });  

    before('should find the peer', function(done) {
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
            console.log("got the identity list", err, data);
            done();
        });
    });
    
    function traverse(item, endpointList) {
        if (typeof item === "object") {
            for (child in item) {
                if (typeof item[child] === "object") {
                    if (child !== '#') { endpointList.push(child); }
                    traverse(item[child], endpointList);
                }
            }
        }
    }
    
    it('shuold test control.model', function(done) {
        console.log('sending mist.control.model to peer:', peer);
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            console.log("Got a model:", err, model);
            
            /* Make some sporadic tests to confim that it actually works */
            
            var epList = new Array();
            traverse(model, epList);
            if (epList.length === epCount) {
                done();
            }
        });
    });
    
    it ('should test follow', function (done) {
        var followResultCount = 0;
       mist.request('mist.control.follow', [peer], function (err, data) {
           followResultCount++;
           if (followResultCount >= epCount) {
                done();
            }
           console.log('data', data);
       }); 
    });
});