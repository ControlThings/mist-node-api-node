var WishApp = require('../../index.js').WishApp;
var inspect = require('util').inspect;

describe('MistApi Identity', function () {
    var app;
    
    before(function (done) {
        app = new WishApp({ name: 'Generic UI', corePort: 9095 });

        setTimeout(function() {
            app.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });

    it('should get error on identity not found', function(done) {
        app.request('identity.get', [new Buffer('deadbeefabababababababababababababababababababababababababababab', 'hex')], function (err, data) {
            if(err) { if (data.code === 997) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });
    
    it('should fail to create identity without alias', function(done) {
        app.request('identity.create', [], function(err, data) {
            if (!err) { return done(new Error('Not an error as expected.')); }
            if (data.code !== 309) { return done(new Error('Not the expected 309 error code as expected.')); }

            done();
        });
    });
    
    it('should fail to create identity, alias not string', function(done) {
        app.request('identity.create', [42], function(err, data) {
            if (!err) { return done(new Error('Not an error as expected.')); }
            if (data.code !== 309) { return done(new Error('Not the expected 309 error code as expected.')); }

            done();
        });
    });

    it('should get identity data', function(done) {
        app.request('identity.create', ['Leif Eriksson'], function(err, data) {
            var uid = data.uid;
            app.request('identity.get', [uid], function (err, data) {
                if(err) { if (data.code === 997) { return done(new Error('identity.get returned '+data.code)); } }
                   
                app.request('identity.remove', [data.uid], function (err, data) {
                    if(err) { if (data.code === 997) { return done(new Error('identity.remove returned '+data.code)); } }

                    done();
                });
            });
        });
    });
    
    it('should create identity with valid transport', function(done) {
        app.request('identity.create', ['Madame de Pompadour'], function(err, data) {
            var uid = data.uid;
            app.request('identity.get', [uid], function (err, data) {
                if(err) { if (data.code === 997) { return done(new Error('identity.get returned '+data.code)); } }
                 
                /* The code below is actaually a duplicate with wish-friends.js */
                for (var i in data.hosts) {
                    var o = data.hosts[i];
                    if (Array.isArray(o.transports)) {
                        //console.log("transports:", o.transports);

                        /* Test success criterion: There must be at least one transport, and it must be string starting with: wish */
                        var url = o.transports[0];

                        if (typeof(url) === "string") {
                            if (url.startsWith("wish")) {
                                done();
                                return;
                            }
                            else {
                                console.log("url is", url);
                                return done(new Error("Transport url is malformed in identity.get(Bob.uid) from Alice, does not start with 'wish': " + url));
                            }
                        } else {
                            return done(new Error("Transport url is not string in identity.get(Bob.uid) from Alice"));
                        }


                    } else {
                        return done(new Error("There is no transports array in identity.get(Bob.uid) from Alice"));
                    }
                }
                
            });
        });
    });
    
});