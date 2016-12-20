var Mist = require('./').Mist;

var mist = new Mist();

mist.request('mist.listServices', [], function(err, data) {

    /*
    for(var i in data) {
        (function(i, d) {
            mist.request('control.model', [d], function(err, data) {
                console.log("Model:", i, data);
            });
        })(i, data[i]);
    }
    */
   
    var id = mist.request('control.follow', [data[2]], function(err, data) {
        console.log("Follow update:", data);
    });
    
    setTimeout(function() {
        mist.requestCancel(id);
    }, 2000);

});



