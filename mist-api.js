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
   
    var follow = mist.request('control.follow', [data[2]], function(err, data) {
        console.log("Follow update:", data);
    });
    
    setTimeout(function() {
        mist.requestCancel(follow);
    }, 2000);

    //mist.request('control.write', [data[4], 'button1', true], function(err, data) {
    //    console.log("Follow update:", data);
    //});
    
    /*
    var to;
    var from;
    var fromEpid;
    var fromOpts = { type: 'direct', interval: 'change' };
    var toEpid;
    var toOpts = { type: 'write' };
    */
      
    mist.request('control.requestMapping', [data[4] ,data[2], 'button1', { type: 'direct', interval: 'change' }, 'button1', { type: 'write' }], function(err, data) {
        console.log("Follow update:", data);
    });
    
    //mist.wish('identity.list', [], function(err, identities) { });
    
    /*
    mist.request('manage.user.ensure', [data[2], { ensure: "node.js" }], function(err, data) {
        console.log("manage.user.ensure response:", data);
    });
    */

});



