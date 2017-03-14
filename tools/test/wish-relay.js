var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('Wish Relay', function () {
    var mist;
    
    before(function (done) {
        mist = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('ready', [], function(err, ready) {
            if (ready) {
                done();
            } else {
                done(new Error('MistApi not ready, bailing.'));
            }
        });
    });

    
    after(function(done) {
        //console.log("Calling mist.shutdown().");
        mist.shutdown();
        //process.nextTick(function() { console.log('exiting.'); process.exit(0); });
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });    
    
    it('should wait for relays to connect', function(done) { setTimeout(done, 300); });
    
    it('should get list of relays', function(done) {
        mist.wish('relay.list', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core relays:", err, data);
            done();
        });
    });
    
    it('should add relay server', function(done) {
        var host = '127.0.0.1:37008';
        mist.wish('relay.add', [host], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish('relay.list', [], function(err, data) { 
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
        mist.wish('relay.remove', [host], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            mist.wish('relay.list', [], function(err, data) { 
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
});
