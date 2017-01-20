var Mist = require('../index.js').Mist;

var mist = new Mist({ name: 'TheUI', coreIp: '127.0.0.1', corePort: 9095 });

mist.request('mist.listServices', [], function(err, data) {

    var peerA;
    var peerB;
    
    var count = 0;
    
    var done = function() {
        console.log("Done enumerating network.");
        if (peerA && peerB) {
            console.log("Both peers populated");
        } else {
            console.log("Either peer is missing, ", !!peerA, !!peerB);
        }
    };

    for(var i in data) {
        count++;
        (function(i, d) {
            mist.request('control.model', [d], function(err, data) {
                console.log("Model:", i, data.device);
                if (data.device === 'NodeB') { peerA = i; }
                if (data.device === 'Node') { peerB = i; }
                if (--count === 0) {
                    if (typeof done === 'function') { done(); }
                }
            });
        })(i, data[i]);
    }
    
//});

//(function f() {
    
    setTimeout(function() {

        mist.request('control.write', [data[2], 'button1', true], function(err, data) { });
        mist.request('control.write', [data[2], 'button1', false], function(err, data) { });
        mist.request('control.write', [data[1], 'button1', true], function(err, data) { });
        mist.request('control.write', [data[1], 'button1', false], function(err, data) { });

        
        var follow = mist.request('control.follow', [data[2]], function(err, data) {
            console.log("Follow update:", data);
        });

        setTimeout(function() {
            mist.requestCancel(follow);
        }, 2000);

        //mist.request('control.write', [data[4], 'button1', true], function(err, data) {
        //    console.log("Follow update:", data);
        //});

        /*
        var to;
        var from;
        var fromEpid;
        var fromOpts = { type: 'direct', interval: 'change' };
        var toEpid;
        var toOpts = { type: 'write' };
        */

        mist.request('control.requestMapping', [data[1] ,data[2], 'button1', { type: 'direct', interval: 'change' }, 'button1', { type: 'write' }], function(err, data) {
            console.log('control.requestMapping', err, data);
        });

        //mist.wish('identity.list', [], function(err, identities) { });

        /*
        mist.request('manage.user.ensure', [data[2], { ensure: "node.js" }], function(err, data) {
            console.log("manage.user.ensure response:", data);
        });
        */
       
    }, 300);

});



