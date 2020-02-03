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
var Sandboxed = require('../../index.js').Sandboxed;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

describe('Wish Local Discovery', function () {
    var mist;
    var name = 'Alice';
    var mistIdentity;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') {
                    util.ensureIdentity(mist, name, function(err, identity) {
                        if (err) { done(new Error('util.js: Could not ensure identity.')); }
                        mistIdentity = identity;
                        done(); 
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
                    util.ensureIdentity(bobMist, "Bob", function(err, identity) {
                        if (err) { done(new Error('util.js: Could not ensure identity.')); }
                        done(); 
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
                mist.wish.request('wld.announce', [], function(err, data) {
                    if (err) { if (data.code === 8) { done(new Error('wld.announce does not exist')); } }
                    
                    console.log("Announce returned:", err, data);
                });
            }
            
            if (data[0] && data[0] === 'localDiscovery') {
                done();
                done = function() {};
            }
            
            //done(new Error('Not the expected error.'));
        });
    });
    /*
    it('should disconnect all connections', function(done) {
        mist.wish.request('connections.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            if(data.length === 0) {
                return done(new Error('Expected there to be at least one connection, before testing disconnectAll'));
            }
            
            mist.wish.request('connections.disconnectAll', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                
                if (data !== true) { return done(new Error('expected "true", but got unexpected return value: '+inspect(data))); }

                mist.wish.request('connections.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }
                    
                    if (data.length > 0) {
                        return done(new Error('Not expecting a connection to be present.'));
                    }
                    
                    done();
                });
            });
        });
    });
    */
    
    it('should add a wifi', function(done) {
        mist.request('commission.add', ['wifi', 'mist-315 S. Broad St.'], function(err, data) {
            console.log('Warning. No checks!');
            done();
        });
    });
    
    it('should find wifi in commission.list', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            var sid = data[0].id;
            
            mist.request('sandboxed.commission.list', [sid], function(err, data) {
                //console.log('wld.list', err, data);
                console.log('Warning. No checks!');
                done();
            });
        });
    });
});
