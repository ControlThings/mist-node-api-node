var Mist = require('../../index.js').Mist;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();

describe('MistApi Friends', function () {
    var list = [];
    
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
        var count = 4;
        
        for(var i=0; i<count; i++) {
            (function(i) {
                console.log('Creating number '+i);
                var mist = new Mist({ name: 'WishApp-'+i, type: 4, coreIp: '127.0.0.1', corePort: 9094 });

                list.push(mist);

                setTimeout(function() {
                    var expired = false;
                    mist.wish('signals', [], function(err, data) {
                        if (expired) { return; } else { expired = true; }
                        console.log('decreasing count from', count);
                        if( --count === 0 ) { console.log("=============== We are all done", err, data); done(); }
                    });
                }, 200);
            })(i);
        }
    });
});
