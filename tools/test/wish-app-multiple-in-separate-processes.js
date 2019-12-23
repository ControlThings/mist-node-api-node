var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;
const child = require('child_process');

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();
var util = require('./deps/util.js');

/**
 * This test starts multiple copies of WishApps, each spawned in separate node.js process.
 * Success is measured on wheter the started apps appear in 'services.list'. Note that the Wish core must support enough services.
 * 
 * Start like this:
 * 
 * ```
 * rm -rf env/; WISH=~/controlthings/mist/wish-c99/build/wish-core DEBUG=1 node test-suite.js test/wish-app-multiple-in-separate-processes.js
 * ```
 */

/** The number of MistApp and WishApp instances to start for the
 * test. The total number of services will be count + 1.
 * 
 * Findings:
 *  - Wish core must support total number of services (WISH_MAX_SERVICES)
 *  - NUM_APP_CONNECTIONS must be large enough 
 *  - NUM_WISH_APPS, wish_app.h must equal or greater to (count + 1)
 *  - NUM_MIST_APPS, mist_app.h  must be >= (count + 1)

 * and then finally, the libUV threadpool size, process.env.UV_THREADPOOL_SIZE, in test-suite.js must be large enough
 * 
 * Probably also "max peers" variable in mistapi must be large enough to allow for all the peers...
 *
 */
var count = 50;  // total of 10 services, plus one for the WishApp used for ensuring identity.

describe('Multi Wish app (separate processes)', function () {
    var list = [];
    var subProcesses = [];
    var app;

    before(function(done) {
        app = new WishApp({ name: 'WishApp', protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
        app.on('ready', function() { 
            app.request('signals', [], (err, sig) => {
                console.log("sig", sig);
            });
            done(); 
        });
        app.on('online', function(peer) {
            console.log('Peer:', peer);
            
        });
        
    });

    before(function(done) {
        util.ensureIdentity(app, "User", function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }

            done(); 
        });
    });


    it('should setup multiple WishApp service instances', function(done) {
        this.timeout(10*1000);
        
        function checkServiceList(done) {
            app.request('services.list', [], function(err, data) {
                console.log("Services:", data);
                //console.log('Here we see the instances:', err, data, list);
                
                var missing = [];
                
                for(var i in list) {
                    var expected = list[i];
                    
                    var found = false;
                    for(var j in data) {
                        var service = data[j];
                        
                        if (expected === service.name) { found = true; break; }
                    }
                    
                    if (!found) { missing.push(expected); }
                }
                
                if (missing.length > 0) {
                    return done(new Error('Missing expected apps from services.list: '+ missing.join(', ')));
                }

                for (var p of subProcesses) {
                    p.kill('SIGHUP');
                }

                done();
            });
            
        }

        for(var i=0; i<count; i++) {
            var instanceName = "instance-" + i;
            existingEnv = process.env;
            existingEnv["TEST_INSTANCE_NAME"] = instanceName;
            existingEnv["TEST_CORE_PORT"] = "9095";
            var serviceProcess = child.spawn('node', [ '../test/deps/basic-wish-app.js' ], { stdio: 'inherit', env: existingEnv });

            list.push(instanceName);
            subProcesses.push(serviceProcess);     
        }

        setTimeout( () => {
            checkServiceList(done)
        }, 5*1000);

    });
});
