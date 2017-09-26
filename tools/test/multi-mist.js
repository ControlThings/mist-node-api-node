var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var WishApp = require('../../index.js').WishApp;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

describe('Multi Mist', function () {
    var list = [];

    it('should setup multiple Mist instances', function(done) {
        this.timeout(5000);
        
        var count = 8;
        
        function checkServiceList(done) {
            list[0].request('services.list', [], function(err, data) {
                //console.log('Here we see the instances:', err, data, list);
                
                var missing = [];
                
                for(var i in list) {
                    var mist = list[i];
                    
                    var found = false;
                    for(var j in data) {
                        var app = data[j];
                        
                        if (mist.opts.name === app.name) { found = true; break; }
                    }
                    
                    if (!found) { missing.push(mist.opts.name); }
                }
                
                if (missing.length > 0) {
                    return done('Missing expected apps from services.list: '+ missing.join(', '));
                }
                
                done();
            });
        }
        
        for(var i=0; i<count; i++) {
            (function(i) {
                //console.log('creating instance: ', i);
                //var mist = new MistNode({ name: 'MistNode-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
                //var mist = new Mist({ name: 'MistApp-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
                var mist = new WishApp({ name: 'WishApp-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });

                list.push(mist);

                setTimeout(function() {
                    var expired = false;
                    mist.request('signals', [], function(err, data) {
                        //console.log('signals in WishApp-'+i+": ", data); //, ' (waiting for signals: '+count+')');
                        if (expired) { return; } else { expired = true; }
                        if( --count === 0 ) { checkServiceList(done); }
                    });
                }, 200);
            })(i);
        }
    });
});
