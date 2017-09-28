var EventEmitter = require('events').EventEmitter;
//var MistNode = require('mist-api').MistNode;
var MistNode = require('../index.js').MistNode;
var util = require("util");

if (!process.env.NAME) {
    console.log('Use: NAME="Chat1" to run several instances.');
}

var model = {
    mist: {
        "type": "string",
        "#": {
            name: {
                "type": "string",
                "read": true
            },
            product: {
                type: 'string',
                read: true,
                '#': {
                    type: {
                        type: 'string', read: true
                    }
                }
            }
        }
    },
    msg: {
        label: "Chat message",
        type: "string",
        read: true,
        write: true
    },
    complex: {
        type: "invoke",
        invoke: true
    }
};

var node = new MistNode({ name: process.env.NAME || 'chat1' });

node.create(model);
node.update('mist.product.type', 'mist_chat');
node.update('mist.name', 'Andrés chat');

node.onlineCb = function(peer) {
    node.wish('identity.get', [peer.ruid], function(err, data) {
        node.requestNode(peer, 'control.read', ['mist.name'], function(err, name) {
            console.log('online:', data.alias, name); 
        });
    });
    
    node.requestNode(peer, 'control.follow', [], function(err, data) {
        console.log('follow signal:', err, data);
    });
    
    node.requestNode(peer, 'control.invoke', ['complex', { that: 'is', awsome: true }], function(err, data) {
        console.log('follow signal:', err, data);
    });
};

node.offlineCb = function(peer) {
    node.wish('identity.get', [peer.ruid], function(err, data) { console.log('offline:', data.alias); });
};

node.invoke('complex', function(args, peer, cb) {
    node.wish('identity.get', [peer.ruid], function(err, data) {
        cb({ you: data.alias, sent: args });
    });    
});

node.on('ready', function() {
    console.log('node ready.');
});

process.stdin.on('data', function(data) {
    node.update('msg', data.toString().trim());
});

node.write(function(epid, value) {
    node.update(epid, value);
});


