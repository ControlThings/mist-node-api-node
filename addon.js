
var addon = require('./build/Release/MistApi.node');

console.log("Addon:", addon);

console.log("hello:", addon.hello(5,7));

var test = new addon.tpl();


/*
var Mist = require('./index.js').Mist;
    
mist = new Mist({ name: 'FriendManager', coreIp: '127.0.0.1', corePort: 9094 });

mist.request('ready', [], function(err, data) {

    bob = new Mist({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

    bob.request('ready', [], function(err, data) {
        console.log("Calling mist.shutdown();");
        mist.shutdown();
    });
});
*/
