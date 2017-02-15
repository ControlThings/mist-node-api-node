var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;

describe('MistApi Friends', function () {
    var mist;
    var bob;
    
    before(function(done) {
        mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

        mist.request('signals', [], function(err, data) {
            console.log("in ready cb", err, data);
            if(data === 'ready') { done(); }; // else { done(new Error('App not ready, bailing.')); }
        });
    });
    
    after('should start bob', function(done) {
        process.nextTick(function() { mist.shutdown(); });
        done();
    });

    function removeIdentity(alias, done) {
        mist.wish('identity.list', [], function(err, data) {
            
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
    
    it('should delete identity', function(done) {
        removeIdentity('Master', done);
    });

    it('should start bob', function(done) {
        console.log("getting bobs identity list");
        mist.wish('identity.create', ['Master'], function(err, data) {
            console.log("identity.create('Master'): cb", err, data);
            done();
        });
    });

    it('should start bob', function(done) {
        console.log("getting bobs identity list");

        mist.request('signals', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("signals", err, data);
            
            //done();
        });
        
        
        var joystick = new MistNode({ name: 'Joystick', coreIp: '127.0.0.1', corePort: 9094 });
        
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
    
    it('should delete identity', function(done) {
        removeIdentity('Master', done);
    });
});