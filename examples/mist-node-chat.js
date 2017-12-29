var EventEmitter = require('events').EventEmitter;
//var MistNode = require('mist-api').MistNode;
var MistNode = require('../index.js').MistNode;
var util = require("util");

if (!process.env.NAME) { console.log('Use: NAME="Chat1" to run several instances.'); }

var node = new MistNode({ name: process.env.NAME || 'chat1' });

// add `mist` endpoint
node.addEndpoint('mist', { type: 'string' });
// add `mist.name` as subendpoint to mist
node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { cb(null, "Chat"); } });

node.addEndpoint('msg', { type: 'invoke', invoke: function(args, peer, cb) { console.log('msg:', args); cb(null, true); } });

node.onlineCb = function(peer) {
    console.log('online event');
        
    node.wish.request('identity.get', [peer.ruid], function(err, data) {
        console.log('identity', data.alias);
        
        //console.log('online, requesting mist.name:', peer);
    });
    
    node.request(peer, 'control.read', ['mist.name'], function(err, name) {
        console.log('control.read("mist.name"):', name); 
    });
    

    /*
    node.request(peer, 'control.follow', [], function(err, data) {
        console.log('follow signal:', err, data);
    });
    
    node.request(peer, 'control.invoke', ['complex', { that: 'is', awsome: true }], function(err, data) {
        console.log('invoke res:', err, data);
    });
    */
};

node.offlineCb = function(peer) {
    node.wish.request('identity.get', [peer.ruid], function(err, data) { console.log('offline:', data.alias); });
};

node.on('ready', function() {
    console.log('node ready.');
});

process.stdin.on('data', function(data) {
    //node.update('msg', data.toString().trim());
});
