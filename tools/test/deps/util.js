
function clear(mist, cb) {
    var isMistApi = true;
        
    if (typeof mist.wish !== 'function') {
        mist = { wish: mist.request.bind(mist) };
        isMistApi = false;
    }

    function removeIdentity(cb) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("removeIdentity has data", data);
            
            var c = 0;
            var t = 0;
            
            for(var i in data) { c++; t++; }            
            
            for(var i in data) {
                (function (uid) {
                    mist.wish('identity.remove', [uid], function(err, data) {
                        if (err) { return cb(new Error(inspect(data))); }

                        //console.log("Deleted.", err, data);

                        c--;

                        if(c===0) { cb(); }
                    });
                })(data[i].uid);
            }
            
            if (t===0) {
                console.log("Identity does not exist.");
                cb();
            }
        });
    }
    
    removeIdentity(function(err) {
        if (err) { return cb(err); }
        
        var c = 0;
        var t = 0;
        
        if (isMistApi) {
            mist.request('sandbox.list', [], function (err, data) {
                console.log('sandbox.list', err, data);
                
                for (var i in data) {
                    var sandboxId = data[i].id;
                    
                    (function(sandboxId) {
                        mist.request('sandbox.listPeers', [sandboxId], function(err, data) {
                            console.log('sandbox.listPeers', err, data);

                            for (var i in data) {
                                var peer = data[i];

                                c++;
                                t++;

                                mist.request('sandbox.removePeer', [sandboxId, peer], function(err, data) {
                                    c--;
                                    console.log('One down,', c, '('+t+')', err, data);
                                    if (c === 0) { cb(null); }
                                });
                            }
                        });
                    })(sandboxId);
                }
            });
        } else {
            cb(null);
        }
    });
}

function ensureIdentity(mist, alias, cb) {
    if (typeof mist.wish !== 'function') {
        mist = { wish: mist.request.bind(mist) };
    }
    
    //console.log("should create identity: getting identity list");
    mist.wish('identity.create', [alias], function(err, data) {
        console.log("identity.create('"+alias+"'): cb", err, data);
        cb(null, data);
    });
}

module.exports = {
    clear: clear,
    ensureIdentity: ensureIdentity };
