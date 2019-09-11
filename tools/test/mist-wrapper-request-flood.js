/**
 * This test tests the Mist node.js wrapper in the situation where a very large number of requests are send to the core simulaneously.
 */

var WishApp = require('../../index.js').WishApp;
var inspect = require('util').inspect;


describe('Request flood', function () {
    var app;
    var opts = { name: 'Flooder', protocols: ['flood'], corePort: 9095 };

    before(function (done) {
        app = new WishApp(opts);

        app.on('ready', function() {
            done();
        });
    });

    it('makes a lot of requests', function(done) {
        const numRequests = 1000;
        var numCbActivations = 0;
        const allowedTime = 1000; // 1 second
        for (i = 0; i < numRequests; i++) {
            console.log("Requesting", i);
            app.request('services.list', [], (err, data) => {
                if (err) { 
                    var _done = done; 
                    done = () => {}; 
                    return _done(new Error("Request error" + inspect(data))); 
                }
                
                if (data) {
                    numCbActivations++;
                }
            });
        }
        setTimeout(() => {
            if (numCbActivations === numRequests) {
                done();
            }
            else {
                done(new Error('Made ' + numRequests + ' requests, but only ' + numCbActivations + 'callbacks!'));
            }
        }, allowedTime);
    });
});
