var Mist = require('../../index.js').Mist;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

describe('Multi Mist', function () {
    var list = [];

    it('should setup multiple Mist instances', function(done) {
        var count = 4;
        
        function checkServiceList(done) {
            list[0].wish('services.list', [], function(err, data) {
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
                var mist = new Mist({ name: 'WishApp-'+i, type: 4, coreIp: '127.0.0.1', corePort: 9095 });

                list.push(mist);

                setTimeout(function() {
                    var expired = false;
                    mist.wish('signals', [], function(err, data) {
                        if (expired) { return; } else { expired = true; }
                        if( --count === 0 ) { checkServiceList(done); }
                    });
                }, 200);
            })(i);
        }
    });
});
