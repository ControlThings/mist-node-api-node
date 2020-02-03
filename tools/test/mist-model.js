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
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
var util = require('./deps/util.js');

var inspect = require('util').inspect;

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

    before('should start a mist node, last added endpoint is a "child node" (tree.leaf)', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        var name = 'Just a Name';
        
        node.addEndpoint('test', { type: 'string' });
        node.addEndpoint('mist', { type: 'string', read: null });
        node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { cb(null, name) } });
        node.addEndpoint('test2', { type: 'string' });
        
        node.addEndpoint('name', { label: 'Name', type: 'string', read: true, write: true });
        node.addEndpoint('enabled', { label: 'Enabled', type: 'bool', read: true, write: true });
        node.addEndpoint('lon', { label: 'Longitude', type: 'float', read: true });
        node.addEndpoint('counter', { label: 'Counter', type: 'int', read: true, write: true });
        node.addEndpoint('device', { type: 'string' });
        node.addEndpoint('device.config', { label: 'Config', invoke: true });
        node.addEndpoint('readProblem', { label: 'Problem', type: 'string', read: function(args, peer, cb) { cb({ code: 6, msg: 'Read says no.' }); } });
        node.addEndpoint('writeProblem', { label: 'Problem', type: 'string', write: function(args, peer, cb) { cb({ code: 6, msg: 'Write says no.' }); } });
        node.addEndpoint('invokeProblem', { label: 'Problem', invoke: function(args, peer, cb) { cb({ code: 6, msg: 'Invoke says no.' }); } });
        node.addEndpoint('temporary', { label: 'Removable', type: 'int', read: true, write: true });
        node.removeEndpoint('temporary');        
        node.addEndpoint('tree', { type: 'string'});
        node.addEndpoint('tree.leaf', { label: 'Tree leaf', type: 'string', read: true});
        node.addEndpoint('ordinary', { label: 'Ordinary', type: 'string', read: true});
        
        node.read('name', function(args, peer, cb) { cb(null, 'root:'+ name); });
        
        node.read('enabled', function(args, peer, cb) { cb(null, enabled); });
        
        node.read('lon', function(args, peer, cb) { cb(null, 63.4); });
        
        node.read('counter', function(args, peer, cb) { cb(null, 56784); });
        
        node.invoke('device.config', function(args, peer, cb) {
            cb(null, { cool: ['a', 7, true], echo: args });
        });
        
        node.write('enabled', function(value, peer, cb) {
            //console.log('Node write:', epid, peer, data);
            cb(null);
        });
        
        node.read('tree.leaf', function (args, peer, cb) {
            cb(null, true);
        });
        node.read('ordinary', function (args, peer, cb) {
            cb(null, true);
        });
        
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
    
    it('shuold test control.model', function(done) {
        console.log('sending mist.control.model to peer:', peer);
        mist.request('mist.control.model', [peer], function (err, model) {
            if (err) { return done(new Error(inspect(model))); }
            //console.log("Got a model:", err, inspect(model, null, 10, true));
            console.log("Got a model:", err, model);
            
            /* Make some sporadic tests to confim that it actually works */
            
            if (typeof model.mist !== 'undefined'  && typeof model.counter.label === 'string') {
                if (typeof model.temporary === 'undefined') { //endpoint 'temporary' was added, then deleted immediately after! 
                    done();
                }
            }
            
            
        });
    });
    
    it ('should test follow', function (done) {
       mist.request('mist.control.follow', [peer], function (err, data) {
           done();
           done = function () { }
           console.log('data', data);
       }); 
    });
});