var Mist = require('../../index.js').Mist;
var Sandboxed = require('../../index.js').Sandboxed;

describe('MistApi Sandbox', function () {
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

    it('should get signals', function(done) {
        mist.request('signals', [], function(err, data) {
            //console.log("signals", err, data);
            done();
            done = function() {};
        });
    });
    
    var gpsSandboxId = new Buffer('dead00ababababababababababababababababababababababababababababab', 'hex');
    var controlThingsSandboxId = new Buffer('beef00ababababababababababababababababababababababababababababab', 'hex');
    
    var peer;

    it('should find a peer', function(done) {
        mist.request('listPeers', [], function(err,data) {
            console.log("mist.listPeers", err, data);
            
            var list = [];
            
            for (var i in data) {
                list.push(data[i]);
            }
            
            if(list.length>0) {
                peer = list[0];
                done();
            } else {
                done(new Error('No peer found!'));
            }
        });
    });
    
    it('shuold list sandboxes', function(done) {
        mist.request('sandbox.list', [], function(err, data) {
            console.log("sandbox.list", err, data);
            done();
        });
    });
    
    it('shuold list peers for gps sandbox', function(done) {
        mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
            console.log("peers allowed for gpsSandbox", err, data);
            done();
        });
    });
    
    it('shuold add peer to gps sandbox', function(done) {
        mist.request('sandbox.addPeer', [gpsSandboxId, peer], function(err, data) {
            console.log("addPeer response for gpsSandbox", err, data);
            
            var ended = false;
            
            mist.request('sandbox.listPeers', [gpsSandboxId], function(err, data) {
                console.log("peers allowed for gpsSandbox", err, data);
                if(!ended) { ended = true; done(); }
            });
        });
    });

    var sandboxedGps;
    var sandboxedControlThings;
    
    it('shuold test sandbox', function(done) {

        this.timeout(5000);

        mist.request('signals', [], function(err, data) {
            console.log("Signal from MistApi", err, data);
        });

        sandboxedGps = new Sandboxed(mist, gpsSandboxId);

        sandboxedGps.request('login', ['Gps App'], function(err, data) {
            console.log("Sandbox login reponse:", err, data);

            var ended = false;

            sandboxedGps.request('signals', [], function(err, data) {
                console.log("sandboxedGps signals:", err, data);
                
                if (data === 'ready') {
                    sandboxedGps.request('listPeers', [], function(err, data) {
                        console.log("sandboxedGps listPeers:", err, data);
                        
                        for(var i in data) {
                            sandboxedGps.request('mist.control.model', [data[i], 'enabled'], function(err, data) {
                                console.log("sandboxedGps model:", err, data);
                                if(!ended) { ended = true; done(); }
                            });
                        }
                    });
                }
                
            });
        });
    });

    it('shuold test a second sandbox', function(done) {
        var sandboxedControlThings = new Sandboxed(mist, controlThingsSandboxId);
        
        sandboxedControlThings.request('login', ['ControlThings App'], function(err, data) {
            console.log("ControlThings Sandbox login reponse:", err, data);

            sandboxedControlThings.request('listPeers', [], function(err, peers) {
                console.log("ControlThings peers:", err, peers);
                done();
            });
        });
    });
    
});