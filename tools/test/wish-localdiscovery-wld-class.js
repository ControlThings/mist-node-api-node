var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

describe('Wish Local Discovery, very long alias and wldClass', function () {
    var mist;
    var name = 'Alice0123456789012345678901234567890123456789'; //very long alias
    var wldClass = 'fi.controlthings.test.0123456789.0123456789' //very long 
    var mistIdentity;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') {
                    util.ensureIdentity(mist, name, function(err, identity) {
                        if (err) { done(new Error('util.js: Could not ensure identity.')); }
                        mistIdentity = identity;
                        mist.wish.request('host.setWldClass', [ wldClass ], function(err, data) {
                            if (err) { done(new Error('Could not set wld class!')); }
                            mist.wish.request('host.skipConnectionAcl', [ true ], function(err, data) {
                                if (err) { done(new Error('Could not set skip connection acl!')); }
                                done(); 
                            });
                        });
                    });
                }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    before(function (done) {
        bobMist = new Mist({ name: 'Generic UI 2', corePort: 9096 });

        setTimeout(function() {
            bobMist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') {
                    util.ensureIdentity(bobMist, "Bob0123456789012345678901234567890123456789", function(err, identity) {
                        if (err) { done(new Error('util.js: Could not ensure identity.')); }
                        
                        bobMist.wish.request('host.setWldClass', [ wldClass ], function(err, data) {
                            if (err) { done(new Error('Could not set wld class!')); }
                            
                            
                            done(); 
                        });
                    });
                }; // else { done(new Error('App not ready, bailing.')); }

            });
        }, 200);
    });

    var sandboxId = new Buffer(32);
    before(function (done) {
         sandboxedGps = new Sandboxed(mist, sandboxId);
        
        //console.log('Sandbox login goes here:', gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            done();
        });
    });


    after(function(done) {
        //console.log("Calling mist.shutdown().");
        mist.shutdown();
        //process.nextTick(function() { console.log('exiting.'); process.exit(0); });
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });

    it('should get a localdiscovery signal', function(done) {
        this.timeout(20000);
        mist.wish.request('signals', [], function (err, data) {
            if (err) { return done(new Error('Signals returned error.')); }
            
            if(data[0] && data[0] === 'ok') {
                mist.wish.request('wld.clear', [], function (err, data) {
                    mist.wish.request('wld.announce', [], function(err, data) {
                        if (err) { if (data.code === 8) { done(new Error('wld.announce does not exist')); } }

                        console.log("Announce returned:", err, data);
                    });
                });
                
            }
            
            if (data[0] && data[0] === 'localDiscovery') {
                mist.wish.request('wld.list', [], function (err, data) {
                    console.log(data);
                    
                    
                    for (x in data) {
                        if (data[x] && data[x].alias && data[x].alias === name && data[x].claim && data[x].class === wldClass) {
                            done();
                            done = function() {};
                        } 
                    }
                    
                    
                });
            }
            
            //done(new Error('Not the expected error.'));
        });
    });

    it('should remove the wld class and it should disappear from broadcast', function(done) {
        this.timeout(20000);
        
        mist.wish.request('host.setWldClass', [ "" ], function(err, data) {
                            
                        
            mist.wish.request('signals', [], function (err, data) {
                if (err) { return done(new Error('Signals returned error.')); }

                if(data[0] && data[0] === 'ok') {
                    mist.wish.request('wld.clear', [], function (err, data) { /* Note: wld.clear required to remove the class. Else it gets cached and will not disappear unless entry disapperas! */
                        mist.wish.request('wld.announce', [], function(err, data) {
                            if (err) { if (data.code === 8) { done(new Error('wld.announce does not exist')); } }

                            console.log("Announce returned:", err, data);
                        });
                    });

                }

                if (data[0] && data[0] === 'localDiscovery') {
                    mist.wish.request('wld.list', [], function (err, data) {
                        console.log(data);


                        for (x in data) {
                            if (data[x] && data[x].alias && data[x].alias === name && data[x].claim && !data[x].class) {
                                done();
                                done = function() {};
                            } 
                        }


                    });
                }

                //done(new Error('Not the expected error.'));
            });
        });
    });
    
});
