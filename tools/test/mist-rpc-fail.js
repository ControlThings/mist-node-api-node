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

describe('MistApi Control', function () {
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

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9095 }); // , coreIp: '127.0.0.1'
        
        node.addEndpoint('mist', { type: 'string' });
        node.addEndpoint('mist.name', { label: 'Name', type: 'string', read: true, write: true });
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

        var name = 'Just a Name';
        
        node.read('mist.name', function(args, peer, cb) { cb(null, name); });
        
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
        
        node.write('mist.name', function(value, peer, cb) {
            //console.log('writing mist.name to', value);
            name = value;
            node.changed('mist.name');
            cb(null);
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
    
    var follow;
    
    // Expect follow to return current values for all readable endpoints
    it('shuold test control.follow initial sync', function(done) {
        var l = ['mist.name', 'enabled', 'lon', 'counter'];
        var end = false;
        follow = mist.request('mist.control.follow', [peer], function (err, data) {
            if(!end) {
                console.log("got one response, canceling req...", err, data);
                mist.requestCancel(follow);
                end = true;
            }
            
            if (err) { if(data.end) { return done(); } }
            
            //return done(new Error(inspect(data)));
            console.log("follow response", err, data);
        });
        
    });
    
    it('should wait for things to settle', function(done) {
        setTimeout(done, 1000);
    });
    
});