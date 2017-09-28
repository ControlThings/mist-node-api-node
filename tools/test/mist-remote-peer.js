var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

var app1;
var app2;

var mistIdentity1;
var mistIdentity2;

describe('Mist remote peer', function () {
    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        setTimeout(done, 200);
    });
    
    before(function(done) {
        console.log('before 2');
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        app2.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        util.clear(app1, done);
    });

    before(function(done) {
        util.clear(app2, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity2 = identity;
            done(); 
        });
    });
    
    before('import mistIdentity2', function(done) {
        console.log('app1.import(mistIdentity2)');
        app1.request('identity.import', [BSON.serialize(mistIdentity2)], function(err, data) {
            done();
        });
    });
    
    before('app1.identity.list', function(done) {
        app1.request('identity.list', [], function(err, data) {
            console.log('identity.list:', err, data);
            done();
        });
    });
    
    before('import mistIdentity1', function(done) {
        app2.request('identity.import', [BSON.serialize(mistIdentity1)], function(err, data) {
            done();
        });
    });

    var mist;
    
    before('start a mist api', function(done) {
        mist = new Mist({ name: 'MistApi', corePort: 9095 }); // , coreIp: '127.0.0.1', corePort: 9095
        
        setTimeout(done, 200);
    });  

    var node;

    before('should start a mist node', function(done) {
        node = new MistNode({ name: 'ControlThings', corePort: 9096 });
        
        node.create({
            enabled: { label: 'Enabled', type: 'bool', read: true, write: true },
            lon: { label: 'Longitude', type: 'float', read: true },
            counter: { label: 'Counter', type: 'int', read: true, write: true },
            config: { label: 'Config', type: 'invoke', invoke: true }
        });
        
        // used to check the read
        node.update('lon', 65.543);
        
        // used for invoke test
        node.invoke('config', function(args, peer, cb) {
            cb({ cool: ['a', 7, true], echo: args });
        });
        
        node.write(function(epid, peer, data) {
            console.log('Node write:', epid, data);
        });
        
        setTimeout(done, 200);
    });  

    var peer;

    before('find the peer', function(done) {
        this.timeout(5000);
        
        function peers(err, data) {
            for(var i in data) {
                if ( Buffer.compare(data[i].luid, mistIdentity1.uid) === 0 
                  && Buffer.compare(data[i].ruid, mistIdentity2.uid) === 0 ) 
                {
                    if (!data[i] || !data[i].online) { console.log('peer -- but not online'); return; }

                    peer = data[0];
                    //console.log("The peers is:", peer);
                    done();
                    done = function() {};
                    
                    break;
                }
            }
        }
        
        mist.request('signals', [], function(err, signal) { 
            //console.log('signal:', err, signal);
            
            if( Array.isArray(signal) ) { signal = signal[0]; } 
            
            if (signal === 'peers') {
                mist.request('listPeers', [], peers);
            }
        });
        
        mist.request('listPeers', [], peers);
    });
    
    it('should send a remote mist model request', function(done) {
        mist.request('mist.control.model', [peer], function(err, model) {
            if (err) { return done(new Error('failed making mist request:'+ inspect(model))); }
            
            if (model.config.type !== 'invoke') {
                return done(new Error('failed making mist model request:'+ inspect(model)));
            }
            
            done();
        });
    });
    
    it('should send a remote mist invoke request', function(done) {
        mist.request('mist.control.invoke', [peer, 'config', {}], function(err, data) {
            if (err) { return done(new Error('failed making mist request:'+ inspect(data))); }
            
            if (!data.cool || data.cool[0] !== 'a') {
                return done(new Error('Unexpected invoke response: '+ inspect(data)));
            }
            
            done();
        });
    });
    
    it('should send a remote mist read request', function(done) {
        mist.request('mist.control.read', [peer, 'lon'], function(err, data) {
            if (err) { return done(new Error('failed making mist request:'+ inspect(data))); }
            
            if (data !== 65.543) { return done(new Error('Unexpected return value when reading: '+data)); }
            
            done();
        });
    });
});