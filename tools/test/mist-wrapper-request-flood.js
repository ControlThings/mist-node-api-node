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
        const allowedTime = 5000;
        this.timeout(allowedTime + 1000);

        const numRequests = 10000; //Will fail if for 100000 requests!
        var numCbActivations = 0;
        var numErrCbActivations = 0;

        for (i = 0; i < numRequests; i++) {
            //console.log("Requesting", i);
            app.request('services.list', [], (err, data) => {
                if (err) { 
                    console.log("Request err return", err);
                    numErrCbActivations++;
                    return;
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
            else if (numCbActivations === numRequests + numErrCbActivations) {
                done(new Error('Unexpected: Made ' + numRequests + ', success: ' + numCbActivations + ' err:' + numErrCbActivations));
            }
            else {
                done(new Error('Fail: Made ' + numRequests + ' requests, but only ' + numCbActivations + 'callbacks, with err CBs: ' + numErrCbActivations +'!'));
            }
        }, allowedTime);
    });
});
