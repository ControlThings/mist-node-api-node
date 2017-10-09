
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
            function deletePeers(peers) {
                
                //console.log('deletePeers', peers);
                
                var count = peers.length;
                var total = peers.length;
                
                for (var index in peers) {
                    (function(sandboxId, peer) {
                        //console.log('running sandbox.removePeer', sandboxId, peer);
                        mist.request('sandbox.removePeer', [sandboxId, peer], function(err, data) {
                            count--;
                            //console.log('One down,', c, err, data, sandboxId);
                            if (count === 0) { done(); }
                        });
                    })(peers[index].sandboxId, peers[index].peer);
                }
            }
            
            // clear the sandboxes
            mist.request('sandbox.list', [], function (err, data) {
                //console.log('sandbox.list', err, data);
                
                var peers = [];
                
                for (var i in data) {
                    var sandboxId = data[i].id;
                    sandboxes++;
                    
                    (function(sandboxId) {
                        mist.request('sandbox.listPeers', [sandboxId], function(err, data) {
                            //console.log('sandbox.listPeers', err, data);
                            sandboxes--;

                            for (var i in data) {
                                var peer = data[i];

                                peers.push({ sandboxId: sandboxId, peer: peer });
                            }
                            if(sandboxes === 0) { deletePeers(peers); }
                        });
                    })(sandboxId);
                }

                //console.log('sandbox.list t:', sandboxes);
                
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
