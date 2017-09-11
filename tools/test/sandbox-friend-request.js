var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;

describe('MistApi Sandbox', function () {
    var mist1;
    var mist2;
    
    before(function (done) {
        mist1 = new Mist({ name: 'Generic UI', coreIp: '127.0.0.1', corePort: 9094 });

        setTimeout(function() {
            mist1.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });

    before(function(done) {
        mist2 = new Mist({ name: 'Generic UI2', coreIp: '127.0.0.1', corePort: 9096 });

        setTimeout(function() {
            mist2.request('ready', [], function(err, ready) {
                if (ready) {
                    done();
                } else {
                    console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }
            });
        }, 200);
    });
    
    before(function(done) {
        node = new MistNode({ name: 'ControlThings', coreIp: '127.0.0.1', corePort: 9096 });
        node.create({
            state: { label: 'State', type: 'bool', read: true, write: true } 
        });
        
        node.write(function(epid, data) {
            console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 1000);
        
    });
    
    before(function(done) {
        mist2.wish('identity.list', [], function(err, data) {
            console.log('services.list', err, data);
            done();
        });
    });
    
    after(function(done) {
        //console.log("Calling mist.shutdown().");
        mist1.shutdown();
        //process.nextTick(function() { console.log('exiting.'); process.exit(0); });
        setTimeout(function() { /*console.log('exiting.');*/ process.exit(0); }, 150);
        done();
    });    
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    
    var sandboxedGps;
    
    var requestToBeAccepted;
    
    it('shuold test sandbox settings without hint', function(done) {

        var signals = mist1.request('signals', [], function(err, data) {
            console.log("Signal from MistApi", err, inspect(data, null, 10, true));
            if(data[0] && data[0] === 'sandboxed.settings') {
                requestToBeAccepted = data[1];
                done();
                mist1.requestCancel(signals);
            }
        });

        sandboxedGps = new Sandboxed(mist1, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            sandboxedGps.request('wish.identity.list', [], function(err, data) {
                console.log('Sandbox sees these identities:', err, data);
                
                if (data[0]) {
                    var uid = data[0].uid;
                    
                    
                    
                    var cert = BSON.serialize({ data: BSON.serialize({ alias: 'Mr Someone', uid: new Buffer(32), pubkey: new Buffer(32), hid: new Buffer(32), sid: new Buffer(32), protocol: 'ucp' }), meta: new Buffer(16), signatures: [] });
                    
                    console.log('sending request from sandbox', [uid, cert]);
                    
                    sandboxedGps.request('wish.identity.friendRequest', [uid, cert], function(err, data) {
                        console.log('Sandbox got response for wish.identity.friendRequest', err, data);
                    });
                }
            });
            
        });
    });
    
    it('should accept the request from sandbox', function(done) {
        // 'sandbox.addPeer'
        
        mist1.request('sandbox.allowRequest', [requestToBeAccepted.id, requestToBeAccepted.hint], function(err, data) {
            console.log('sandbox.allowRequest response:', err, data);
        });
    });
});