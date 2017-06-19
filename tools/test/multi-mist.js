var Mist = require('../../index.js').Mist;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

describe('MistApi Friends', function () {
    var list = [];
    var bob;
    
    before(function (done) {
        done();
    });
    
    after(function(done) {
        console.log("Calling mist.shutdown();");
        //bob.shutdown();
        
        for(var i in list) {
            list[i].shutdown();
        }
        
        //mist.shutdown();
        
        done();
    });

    it('should get bob', function(done) {
        for(var i=0; i<5; i++) {
            console.log('Creating number '+i);
            var mist = new Mist({ name: 'WishApp-'+i, type: 4, coreIp: '127.0.0.1', corePort: 9094 });
        
            list.push(mist);

            setTimeout(function() {
                var expired = false;
                mist.wish('signals', [], function(err, data) {
                    if (expired) { return; } else { expired = true; }
                    console.log("in ready cb", err, data);
                    if(data) { done(); } else { done(new Error('App not ready, bailing.')); }
                });
            }, 200);
        }
    });
});
