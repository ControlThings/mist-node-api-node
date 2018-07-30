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

describe('WishApp Peers', function () {
    before('setup PeerTester1', function(done) {
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        app1.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        util.clear(app1, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            mistIdentity1 = identity;
            done(); 
        });
    });
    
    it('should stream 1 MiB of data', function(done) {
        var t0 = Date.now();
        var cnt = 0;
        
        function req() {
            app1.request('identity.list', [], (err, data) => {
                cnt++;
                if (Date.now() - t0 > 1000) { console.log('Request count', cnt); return done(); }

                setTimeout(req, 0);
            });
            //app1.request('identity.list', [], (err, data) => { cnt++; });
        }
        
        req();
    });
});