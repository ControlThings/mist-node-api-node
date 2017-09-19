var WishApp = require('../../index.js').WishApp;
var inspect = require('util').inspect;

describe('Wish Directory', function () {
    var app;

    before(function (done) {
        app = new WishApp({ name: 'Generic UI', corePort: 9095 });

        app.on('ready', function() {
            done();
        });
    });

    it('should get not implemented', function(done) {
        this.timeout(5000);
        
        var count = 0;
        app.request('directory.find', ['Bob', 2000], function(err, data) {
            //if (err) { return done(new Error(inspect(data))); }
            
            count++;
            
            if (count === 2000) {
                console.log("All done:", err, data);
                done();
            }
        });
    });
});
