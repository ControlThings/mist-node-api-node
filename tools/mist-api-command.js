var Mist = require('../index.js').Mist;
var inspect = require('util').inspect;

var mist = new Mist();

if (process.env.ID) {
    var id = process.env.ID;
    var cmd = process.argv[2];
    var p1 = process.argv[3];
    var p2 = process.argv[4];
    
    switch (cmd) {
        case 'model':
            mist.request('listPeers', [], function(err, data) {
                mist.request('mist.control.model', [data[id]], function(err, res) { 
                    console.log("Model:", id, inspect(res, null, 10, true));
                    mist.shutdown();
                });
            });
            break;
        case 'follow':
            mist.request('listPeers', [], function(err, data) {
                mist.request('mist.control.follow', [data[id]], function(err, res) { 
                    console.log("Follow:", id, res);
                });
            });
            break;
        case 'read':
            mist.request('listPeers', [], function(err, data) {
                mist.request('mist.control.read', [data[id], p1], function(err, res) { 
                    console.log("Read:", id, res);
                    mist.shutdown();
                });
            });
            break;
        case 'write':
            mist.request('listPeers', [], function(err, data) {
                mist.request('mist.control.write', [data[id], p1, JSON.parse(p2)], function(err, res) { 
                    console.log("Write:", id, res);
                    mist.shutdown();
                });
            });
            break;
        case 'invoke':
            mist.request('listPeers', [], function(err, data) {
                mist.request('mist.control.invoke', [data[id], p1, JSON.parse(p2)], function(err, res) { 
                    console.log("Invoke:", id, inspect(res, null, 10, true));
                    mist.shutdown();
                });
            });
            break;
        default:
            console.log("Unknown command: "+cmd);
            break;
    }
} else {
    mist.request('listPeers', [], function (err, data) {

        for (var i in data) {
            (function (i, d) {
                mist.request('mist.control.model', [d], function (err, data) {
                    console.log("Model:", i, data);
                });
            })(i, data[i]);
        }
        
        mist.shutdown();
    });
}



