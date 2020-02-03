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
var inspect = require('util').inspect;

describe('Wish RPC', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            mist.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });

    
    after(function(done) {
        //console.log("Calling mist.shutdown().");
        mist.shutdown();
        //process.nextTick(function() { console.log('exiting.'); process.exit(0); });
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });    

    it('should get error on undefined command', function(done) {
        mist.request('this-does-not-exist', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });

    it('should get error on invalid parameters', function(done) {
        mist.wish.request('identity.export', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });
    
    it('should get version string', function(done) {
        mist.wish.request('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core version string:", err, data);
            done();
        });
    });
    
    it('should get signals', function(done) {
        var signalsId = mist.wish.request('signals', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            if (data[0] !== 'ok') { return; }
            
            console.log("wish-core signals:", err, data, signalsId);
            mist.wish.cancel(signalsId);
            done();
        });
    });
    
    /*
    it('should get error on full rpc using signals', function(done) {
        //this.timeout(25000);
        
        var signals = [];
        
        for(var i=0; i<600; i++) {
            signals.push(mist.wish('signals', [], function(err, data) { 
                if (err) { console.log("What do we have here?", inspect(data)); done(); return done = function() {}; }
                if (data[0] !== 'ok') { return; }

                console.log("wish-core signals:", err, data);
                //mist.wishCancel(signalsId);
                //done();
            }));
        }
    });
    */
});
