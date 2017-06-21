
function ensureIdentity(mist, alias, cb) {
    

    function removeIdentity(alias, cb) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("removeIdentity has data", data);
            
            for(var i in data) {
                if (data[i].alias === alias) {
                    mist.wish('identity.remove', [data[i].uid], function(err, data) {
                        if (err) { return cb(new Error(inspect(data))); }

                        console.log("Deleted.", err, data);
                        cb();
                    });
                    return;
                }
            }
            
            console.log("Identity does not exist.");
            cb();
        });
    }
    
    removeIdentity(alias, function(err) {
        if (err) { return cb(err); }
        
        //console.log("should create identity: getting identity list");
        mist.wish('identity.create', [alias], function(err, data) {
            console.log("identity.create('"+alias+"'): cb", err, data);
            cb(null, data);
        });
    });
    
    
}

module.exports = {
    ensureIdentity: ensureIdentity };
