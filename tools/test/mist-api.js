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

describe('MistApi Control', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9094

        setTimeout(function() {
            mist.request('signals', [], function(err, data) {
                if(data[0] === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
            });
        }, 200);
    });

    it('should get version string', function(done) {
        mist.request('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            done();
        });
    });
});