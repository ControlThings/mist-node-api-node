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

function clear(mist, done) {
    var isMistApi = typeof mist.wish === 'object' && typeof mist.node === 'object';

    var wish = typeof mist.wish === 'object' ? mist.wish : mist;
    
    function removeIdentity(done) {
        wish.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("removeIdentity has data", data);
            
            var c = 0;
            var t = 0;
            
            for(var i in data) { c++; t++; }            
            
            for(var i in data) {
                (function (uid) {
                    wish.request('identity.remove', [uid], function(err, data) {
                        if (err) { return done(new Error(inspect(data))); }

                        //console.log("Deleted.", err, data);

                        c--;

                        if(c===0) { done(); }
                    });
                })(data[i].uid);
            }
            
            if (t===0) {
                //console.log("Identity does not exist.");
                done();
            }
        });
    }
    
    removeIdentity(function(err) {
        if (err) { return done(err); }
        
        var c = 0;
        var t = 0;
        var sandboxes = 0;
        
        if (isMistApi) {
            // clear the sandboxes
            mist.request('sandbox.list', [], function (err, data) {
                //console.log('sandbox.list', err, data);
                
                for (var i in data) {
                    var sandboxId = data[i].id;
                    sandboxes++;
                    
                    (function(sandboxId) {
                        mist.request('sandbox.remove', [sandboxId], function(err, data) {
                            //console.log('sandbox.listPeers', err, data);
                            sandboxes--;

                            if(sandboxes === 0) { done(); }
                        });
                    })(sandboxId);
                }

                if (sandboxes === 0) { done(); }
            });
        } else {
            done();
        }
    });
}

function ensureIdentity(mist, alias, cb) {
    var wish = typeof mist.wish === 'object' ? mist.wish : mist;
    
    //console.log("should create identity: getting identity list");
    wish.request('identity.create', [alias], function(err, data) {
        //console.log("identity.create('"+alias+"'): cb", err, data);
        cb(null, data);
    });
}

module.exports = {
    clear: clear,
    ensureIdentity: ensureIdentity };
