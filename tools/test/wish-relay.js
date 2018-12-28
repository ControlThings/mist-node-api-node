var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('Wish Relay', function () {
    var mist;
    var originalRelays;
    
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
    
    it('should create identity', function(done) { 
        mist.wish.request('identity.create', ['RelayTester'], (err, data) => {
            if (err) { return done(new Error(inspect(data))); }
            done();
        });
    
    });
    
    it('should wait for relays to connect', function(done) { setTimeout(done, 300); });
    
    it('should get list of relays', function(done) {
        mist.wish.request('relay.list', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core relays:", err, data);
            originalRelays = data;
            done();
        });
    });
    
    it('should add relay server', function(done) {
        var host = '127.0.0.1:37008';
        mist.wish.request('relay.add', [host], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    done();
                } else {
                    done(new Error('Could not find the added host in relay list.'));
                }
            });
        });
    });
    
    it('should add relay server (FQDN)', function(done) {
        var host = 'wish-relay.controlthings.fi:37008';
        mist.wish.request('relay.add', [host], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    done();
                } else {
                    done(new Error('Could not find the added host in relay list.'));
                }
            });
        });
    });
    
    it('should delete relay server', function(done) {
        var host = '127.0.0.1:37008';
        mist.wish.request('relay.remove', [host], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    done();
                } else {
                    console.log('Found the removed host in relay list.');
                    done(new Error('Found the removed host in relay list. '+inspect(data)));
                }
            });
        });
    });
    
    it('should delete relay server (FQDN)', function(done) {
        var host = 'wish-relay.controlthings.fi:37008';
        mist.wish.request('relay.remove', [host], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    done();
                } else {
                    console.log('Found the removed host in relay list.');
                    done(new Error('Found the removed host in relay list. '+inspect(data)));
                }
            });
        });
    });
    
    it('should remove the original relays', function(done) {
        
        var cnt = 0
        for (i in originalRelays) {
            mist.wish.request('relay.remove', [originalRelays[i].host], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }
                if (++cnt == originalRelays.length) {
                    done();
                }
            });
        }
    });
    
    it('should add relay server wish.cto.fi:40000', function(done) {
        var host = 'wish.cto.fi:40000';
        mist.wish.request('relay.add', [host], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    done();
                } else {
                    done(new Error('Could not find the added host in relay list.'));
                }
            });
        });
    });
    
    it('should wait for relays to connect (now via DNS)', function(done) { 
        this.timeout(3000);
        setTimeout(done, 2900);
    });
    
    it('should be connecected to wish.cto.fi:40000', function(done) {
        var host = 'wish.cto.fi:40000';
        mist.wish.request('relay.list', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
                console.log(data);
                var found = false;
                var connected = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                    }
                    
                    if (data[i].connected) {
                        connected = true;
                    }
                }

                if (found && connected) {
                    done();
                } else if (!found) {
                    done(new Error('Could not find the added host in relay list.'));
                } else if (!connected) {
                    done(new Error('We were not connected to ' + host));
                }
            });
        
    });
});
