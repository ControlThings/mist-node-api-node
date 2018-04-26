var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;
var MistNode = require('../../index.js').MistNode;
var util = require('./deps/util.js');
var inspect = require('util').inspect;

var bson = require('bson-buffer');
var BSON = new bson();

describe('MistApi Sandbox', function () {
    var mist;
    
    before('Setup Generic UI', function (done) {
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

    var mistIdentity1;
    var mistIdentity2;
    
    var name1 = 'Alice';
    
    before('clear 1', function(done) {
        util.clear(mist, function(err) {
            if (err) { done(new Error('util.js: Could not clear core.')); }
            done(); 
        });
    });
    
    before('ensure 1', function(done) {
        util.ensureIdentity(mist, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    
    it('should list sandboxes', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            console.log("sandbox.list", err, data);
            done();
        });
    });
    
    it('should list wish identities', function(done) {
        mist.wish.request('identity.list', [], function(err, data) {
            console.log("all identities", err, data);
            done();
        });
    });

    var sandboxedGps;

    it('should add peer to gps sandbox', function(done) {
        
        sandboxedGps = new Sandboxed(mist, gpsSandboxId);
        
        console.log('Sandbox login goes here:', gpsSandboxId);
        
        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);
            done();
        });
    });

    it('should get commission.list ', function(done) {
        mist.request('commission.add', ['wifi', 'mist-315 S. Broad St.'], function(err, data) {
            if (err) { return done(new Error('Could not get list.')); }
            
            console.log("Commission.list result: ", err, data);
            done();
        });
    });
    
    it('should get commission.list ', function(done) {
        sandboxedGps.request('commission.list', [], function(err, data) {
            if (err) { return done(new Error('Could not get list.')); }
            
            console.log("Commission.list result: ", err, data);
            done();
        });
    });

    it('should commission.perform with wifi', function(done) {
        this.timeout(10000);
        
        var luid = mistIdentity1.uid;
        
        sandboxedGps.request('commission.perform', [luid, { type: 'wifi', ssid: 'mist-somenetwork', class: 'fi.ct.test.device' }], function(err, data) {
            if (err) { console.log('an error:', err, data); return done(new Error('Could not get list.')); }
            
            if(data === 3) { // WAIT_JOIN_WIFI
                // state machine has started with wifi commissioning, now wait for ON_CONNECTED_TO_EXPECTED_WIFI
            }
            
            console.log("Commission.perform result: ", err, data);
        });
        
        setTimeout(done, 9500);
    });

    it('should commission.perform with local (discovery)', function(done) {
        var luid = mistIdentity1.uid;
        
        sandboxedGps.request('commission.perform', [luid, { type: 'local' }], function(err, data) {
            if (err) { console.log('an error:', err, data); return done(new Error('Could not get list.')); }
            
            console.log("Commission.perform result: ", err, data);
            done();
        });
    });
});