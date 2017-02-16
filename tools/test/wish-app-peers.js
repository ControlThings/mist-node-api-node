var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('MistApi Friends', function () {
    var mist;
    var bob;
    var joystick;
    
    before(function(done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('signals', [], function(err, data) {
            console.log("in ready cb", err, data);
            if(data === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
        });
    });
    
    after('should start bob', function(done) {
        process.nextTick(function() { mist.shutdown(); joystick ? joystick.shutdown() : ''; });
        done();
    });

    function removeIdentity(alias, done) {
        mist.wish('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            for(var i in data) {
                if (data[i].alias === alias) {
                    mist.wish('identity.remove', [data[i].uid], function(err, data) {
                        if (err) { return done(new Error(inspect(data))); }

                        console.log("Deleted.", err, data);
                        done();
                    });
                    return;
                }
            }
            
            console.log("Identity does not exist.");
            done();
        });
    }
    
    it('should delete identity before', function(done) {
        removeIdentity('Master', done);
    });

    xit('should create identity', function(done) {
        console.log("should create identity: getting identity list");
        mist.wish('identity.create', ['Master'], function(err, data) {
            console.log("identity.create('Master'): cb", err, data);
            done();
        });
    });

    xit('should create device', function(done) {
        console.log("should create device: signals req");

        mist.request('signals', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("signals", err, data);
            
            //done();
        });
        
        
        joystick = new MistNode({ name: 'Joystick', coreIp: '127.0.0.1', corePort: 9094 });
        
        joystick.create({
            device: "Joystick",
            model: { 
                mist: { name: "Joystick" },
                axis0: {
                    label: "Left controller axis (left/right)",
                    type: "float",
                    scale: "100",
                    unit: "%",
                    data: 0 }}
        });
        
    });
    
    it('should delete identity after', function(done) {
        removeIdentity('Master', done);
    });
});