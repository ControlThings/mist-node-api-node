var Mist = require('../index.js').Mist;

var mist = new Mist();

if (process.env.ID) {
    var id = process.env.ID;
    mist.request('mist.listServices', [], function(err, data) {
        mist.request('control.write', [data[id], 'button1', true], function(err, res) { 
            setTimeout(function() {
                mist.request('control.write', [data[id], 'button1', false], function(err, data) { mist.shutdown(); });
            }, 2000);
        });
    });

} else {
    mist.request('mist.listServices', [], function (err, data) {

        for (var i in data) {
            (function (i, d) {
                mist.request('control.model', [d], function (err, data) {
                    console.log("Model:", i, data.device);
                });
            })(i, data[i]);
        }
        
        mist.shutdown();
    });
}



