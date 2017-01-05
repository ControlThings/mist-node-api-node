var Mist = require('./').Mist;

var mist = new Mist({ name: 'TheUI', coreIp: '127.0.0.1', corePort: 9095 });

/*
mist.request('sandbox.listPeers', [], function(err, data) {
    console.log("Sandbox reponse:", err, data);
});
*/

var apeer = {
    luid: new Buffer('abababababababababababababababababababababababababababababababab', 'hex'),
    ruid: new Buffer('bbababababababababababababababababababababababababababababababab', 'hex'),
    rhid: new Buffer('cbababababababababababababababababababababababababababababababab', 'hex'),
    rsid: new Buffer('dbababababababababababababababababababababababababababababababab', 'hex'),
    protocol: 'mist'
};

mist.request('mist.sandbox.register', [apeer], function(err, data) {
    console.log("Sandbox register reponse:", err, data);
    
    mist.request('mist.sandbox.list', [], function(err, data) {
        console.log("Sandbox list reponse:", err, data);

    });
});


mist.request('mist.listServices', [], function(err, data) {
    return;

    var peerA;
    var peerB;
    
    var count = 0;
    
    var done = function() {
        console.log("Done enumerating network.");
        if (peerA && peerB) {
            console.log("Both peers populated");
            
            /*
            var to;
            var from;
            var fromEpid;
            var fromOpts = { type: 'direct', interval: 'change' };
            var toEpid;
            var toOpts = { type: 'write' };
            */

            mist.request('control.requestMapping', [data[peerB] ,data[peerA], 'button1', { type: 'direct', interval: 'change' }, 'button1', { type: 'write' }], function(err, mapping) {
                console.log('control.requestMapping', err, mapping);

                /*
                setTimeout(function() {

                    mist.request('control.write', [data[peerA], 'button1', true], function(err, data) { console.log("peerA.control.write +", err, data); });
                    mist.request('control.write', [data[peerA], 'button1', false], function(err, data) { console.log("peerA.control.write -", err, data); });
                    mist.request('control.write', [data[peerB], 'button1', true], function(err, data) { console.log("peerB.control.write +", err, data); });
                    mist.request('control.write', [data[peerB], 'button1', false], function(err, data) { console.log("peerB.control.write -", err, data); });


                    var follow = mist.request('control.follow', [peerA], function(err, data) {
                        console.log("Follow update:", data);
                    });

                    setTimeout(function() {
                        mist.requestCancel(follow);
                    }, 1000);

                    //mist.request('control.write', [data[4], 'button1', true], function(err, data) {
                    //    console.log("Follow update:", data);
                    //});


                    //mist.wish('identity.list', [], function(err, identities) { });

                    
                    //mist.request('manage.user.ensure', [data[2], { ensure: "node.js" }], function(err, data) {
                    //    console.log("manage.user.ensure response:", data);
                    //});
                    

                }, 800);
                */
            });
            
        } else {
            console.log("Either peer is missing, but we will assume index 0 and 1", !!peerA, !!peerB);
            /*
            mist.request('control.requestMapping', [data[1] ,data[0], 'led', { type: 'direct', interval: 'change' }, 'state', { type: 'write' }], function(err, mapping) {
                console.log('control.requestMapping', err, mapping);
            });
            */
        }
    };

    for(var i in data) {
        count++;
        (function(i, d) {
            mist.request('control.model', [d], function(err, data) {
                console.log("Model:", i, data.device);
                if (data.device === 'NodeB') { peerA = i; console.log("set PeerA to", d); }
                if (data.device === 'Node') { peerB = i; console.log("set PeerB to", d); }
                if (--count === 0) {
                    if (typeof done === 'function') { done(); }
                }
            });
        })(i, data[i]);
    }
    
});



