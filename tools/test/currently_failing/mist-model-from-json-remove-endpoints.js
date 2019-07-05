/*
 * This test exhibits the following problems:
 * 
 * - Removing endpoints is very bad in general, because of the mist_endpoint_destroy function which unconditionally attemps to free()
 * - Removing endpoint 'test' succeeds, but then removing the initial endpoint 'mist' fails SOMETIMES!
 * - Attempting to remove any further endpoints results in a crash!
 */

var Mist = require('../../../index.js').Mist;
var MistNode = require('../../../index.js').MistNode;
var WishApp = require('../../../index.js').WishApp;
var util = require('.././deps/util.js');

var inspect = require('util').inspect;
const assert = require('assert');

describe('Mist Model', function () {
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
    
    var peer;
    var end = false;
    var node;
    var enabled = true;
    
    
    var testModel = { 
            "mist": {
                "type": "string",
                "#": {
                    "name": {
                        "label": "Name",
                        "type": "string",
                        "read": true
                    }
                }
            },
            "test": { "label": "This is a test", "type": "string" },
            "level0": {
                "type": "string",
                "#": {
                    "type": "string",
                    "level1": {
                        "label": "Level 1",
                        "type": "string",
                        "read": true,
                        '#': {
                            "type": "string",
                            "level2": {
                                "label": "Level 2",
                                "type": "string",
                                "read": true
                            }
                        }
                    },
                    "level1bis": {
                        "label": "Level 1 bis",
                        "type": "string",
                        "read": true,
                        '#': {
                            //"type": "string",
                            "level2bis": {
                                "label": "Level 2 bis",
                                "type": "string",
                                "read": true
                            }
                        }
                    }
                }
            },
            "test2": { "label": "This is a test", "type": "string" },
            
                    "level1bis": {
                        "label": "Name",
                        "type": "string",
                        "read": true,
                        '#': {
                            "type": "string",
                            "level2bis": {
                                "label": "Name",
                                "type": "string",
                                "read": true
                            }
                        }
                    }
    }
    
   
   /*
    var testModel = { 
            "mist": {
                "type": "string",
                "#": {
                    "name": {
                        "label": "Name",
                        "type": "string",
                        "read": true
                    }
                }
            },
            "test": { "label": "This is a test", "type": "string" }
        };
    */
    function traverse(item, endpointList) {
        if (typeof item === "object") {
            for (child in item) {
                if (typeof item[child] === "object") {
                    endpointList.push(child);
                    traverse(item[child], endpointList);
                }
            }
        }
    }
        
    var originalEndpointList = new Array();
    before('should start a mist node, creating model from JSON document', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.create(testModel);
        traverse(testModel, originalEndpointList);
        node.read("level0.level1.level2",  function(args, peer, cb) { cb(null, 'This is level 2'); })
        node.read("level0.level1",  function(args, peer, cb) { cb(null, 'This is level 1'); })
        node.read("mist.name",  function(args, peer, cb) { cb(null, 'Mist Name'); })
        
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
            console.log("got the identity list", err, inspect(data));
            if (data[0]) {
                done();
            }
        });
    });
    
    it('shuold test control.model', function(done) {
        console.log('sending mist.control.model to peer:', peer);
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model:", err, inspect(model, null, 10, true));
            console.log("Reference", err, inspect(testModel, null, 10, true));
            //console.log("Got a model:", err, model);
          
            var modelEndpointList = new Array();
            traverse(model, modelEndpointList);
            
            if (modelEndpointList.length !== originalEndpointList.length) {
                done(new Error("Models do not match, different length"));
                return;
            }
            
            var differing = false;
            for (i in modelEndpointList) {
                if (originalEndpointList[i] !== modelEndpointList[i]) {
                    differing = true;
                    done(new Error("Models do not match:", originalEndpointList[i], "!==", modelEndpointList[i]));
                    return;
                }
            }
            if (!differing) {
                done();
            }
            
           
        });
    });
    it('shuold followt', function(done) {
        mist.request('mist.control.follow', [peer], function (err, data) {
            if (err) { return done(new Error(inspect(data))); }
            if (data) {
                done();
                done = function() { }
            }
        });
    });
    
    
    it('shuold remove test endpoint', function(done) {
        console.log("Removing ep test");
        node.removeEndpoint('test');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model 1:", err, inspect(model, null, 10, true));
            if (model.test === undefined) {
                done();
            }
            else {
                done(new Error("Endpoint test was not deleted!"));
            }
        });
    });
    
    it('shuold remove first root endpoint', function(done) {
        console.log("Removing ep mist");
        node.removeEndpoint('mist');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model 2:", err, inspect(model, null, 10, true));
            if (model.mist === undefined) {
                done();
            }
            else {
                done(new Error("Endpoint mist was not deleted!"));
            }
        });
    });
    
    /*
    // Removing more endpoints currently leads to a crash!
    it('shuold remove level0 endpoint', function(done) {
        console.log("Removing ep level1bis");
        node.removeEndpoint('level0');
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            console.log("Got a model 3:", err, inspect(model, null, 10, true));
            if (model.level0 === undefined) {
                done();
            }
            else {
                done(new Error("Endpoint level1bis was not deleted!"));
            }
        });
    });
    */
    
    
});