var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();
var util = require('./deps/util.js');

describe('Multi Mist', function () {
    var list = [];
    var app;

    /** The number of MistApp and WishApp instances to start for the
     * test. The total number of services is count + 1.
     * 
     * Findings:
     *  - Wish core must support total number of services
     *  (WISH_MAX_SERVICES), which is 10 currently by default
     * and in mist-c99. That must be increased.
     *  - NUM_WISH_APPS, wish_app.h must equal or greater to (count + 1)
     *  - NUM_MIST_APPS, mist_app.h  must be >= (count + 1)
     *  and finally in unix port,
     *  - NUM_APP_CONNECTIONS 
     * and then finally, the libUV threadpool size, process.env.UV_THREADPOOL_SIZE, in test-suite.js must be large enough
     * 
     * Also, it seems that we must create the services "slowly", if we try to create at once, then errors will ensue! 
     * 
     * It seems that each MistNode, WishApp... takes creates one thread in mist_addon_start().
     * Look at wish_core_client. Is it not so that the various things here are accessed by the threads, without synchronisation? Should we not use libuv's synchronisation things? 
     *
     */
    var count = 50;  // total of 10 services, plus one for the WishApp used for ensuring identity.
    var temporalDispersion = 10*1000; //The amount of time under which the services will start, via setTimeout(). Set this to 0 for failing.

    before(function(done) {
        app = new WishApp({ name: 'WishApp', protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
        app.on('ready', function() { done() });
    });

    before(function(done) {

        console.log("mere");
        util.ensureIdentity(app, "User", function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            console.log("mere2");
            done(); 
        });
    });


    it('should setup multiple WishApp service instances', function(done) {
        this.timeout(100*10000);
        
        function checkServiceList(done) {
            list[0].request('services.list', [], function(err, data) {
                //console.log('Here we see the instances:', err, data, list);
                
                var missing = [];
                
                for(var i in list) {
                    var mist = list[i];
                    
                    var found = false;
                    for(var j in data) {
                        var app = data[j];
                        
                        if (mist.opts.name === app.name) { found = true; break; }
                    }
                    
                    if (!found) { missing.push(mist.opts.name); }
                }
                
                if (missing.length > 0) {
                    return done('Missing expected apps from services.list: '+ missing.join(', '));
                }
                
                done();
            });
        }
        
        for(var i=0; i<count; i++) {
            (function(i) {
                setTimeout(() => {
                    console.log('creating instance: ', i);
                    //var mist = new MistNode({ name: 'MistNode-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
                    //var mist = new Mist({ name: 'MistApp-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
                    var wish = new WishApp({ name: 'WishApp-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });

                    list.push(wish);

                    setTimeout(function() {
                        var expired = false;
                        wish.request('signals', [], function(err, data) {
                            //console.log('signals in WishApp-'+i+": ", data); //, ' (waiting for signals: '+count+')');
                            if (expired) { return; } else { expired = true; }
                            if( --count === 0 ) { checkServiceList(done); }
                        });
                    }, 500);
                }, Math.random()*temporalDispersion);
            })(i);
        }
    });
});
