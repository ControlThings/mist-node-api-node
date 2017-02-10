var bson = require('bson-buffer');
var BSON = new bson();

var sharedId = 0;

var addon = require('./build/Release/MistApi.node');

console.log("Addon:", addon);

console.log("hello:", addon.hello(5,7));

var test = new addon.tpl(
        function(a, b, d) { console.log("1:", a, b, BSON.deserialize(d)); }, 
        function() { console.log("1:", arguments); }, 
        function() { console.log("1:", arguments); }, 
        { name: 'YOYO' });
        
var id = ++sharedId;
var request = { op: "listPeers", args: [], id: id };
test.sendToAddon("mist", 1, BSON.serialize(request));
        
id = ++sharedId;
request = { op: "methods", args: [], id: id };
test.sendToAddon("mist", 1, BSON.serialize(request));
test.printWrapped();
        
//test.sendToAddon("test", "more", new Buffer("Nada"));


//console.log("test:", test.sendToAddon("test","more"));
setTimeout(function() { 
    var me = new addon.tpl(
        function(a, b, d) { console.log("1:", a, b, BSON.deserialize(d)); }, 
        function() { console.log("1:", arguments); }, 
        function() { console.log("1:", arguments); }, 
        { name: 'YOLO' }); 
    //var request = { op: "listPeers", args: [], id: 1 };
    //me.sendToAddon("mist", 1, BSON.serialize(request));
    //me.printWrapped();
}, 1000);
//setTimeout(function() { test.shutdown(); }, 3000);

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
