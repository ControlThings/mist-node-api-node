var Mist = require('../index.js').Mist;
var Sandboxed = require('../index.js').Sandboxed;

var mist = new Mist({ name: 'CleanUpTest', coreIp: '127.0.0.1', corePort: 9094 });

function pollModel(peer) {
    mist.request('mist.control.model', [peer], function (err, data) {
        console.log("Model:", err, data);
        
        process.nextTick(function() { pollModel(peer); });
    });
}

function listPeersCb(err, peers) {
    console.log("listPeersCb:", err, peers);
    
    for (var i in peers) {
        pollModel(peers[i]);
    }
}

function begin() {
    mist.request('signals', [], function(err, data) {
        console.log("Signal from MistApi", err, data);
        if (data === 'peers') {
            mist.request('listPeers', [], listPeersCb);
        }
    });
    mist.request('listPeers', [], listPeersCb);
}

mist.request('ready', [], function(err, data) {
    console.log("MistApi ready():", err, data);
    mist.wish('identity.list', [], function(err, data) {
        console.log("Identities:", err, data, data.length);
        if (data.length === 0) {
            mist.wish('identity.create', ['Mr. Andersson'], function(err, data) {
                console.log("We just created an identity for you.", err, data);
                begin();
            });
        } else {
            begin();
        }
    });
});

