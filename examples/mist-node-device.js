//var MistNode = require('mist-api').MistNode;
var MistNode = require('../index.js').MistNode;

function Motor() {
    var name = 'Motor';
    var number = 42;

    // create a mist node (with a unique name per wish core)
    var node = new MistNode({ name: name }); // , coreIp: '127.0.0.1', corePort: 9094

    // add `mist` endpoint
    node.addEndpoint('mist', { type: 'string' });
    // add `mist.name` as subendpoint to mist
    node.addEndpoint('mist.name', { type: 'string', read: function(args, peer, cb) { cb(null, name); } });
    
    // add readable and writable `number` endpoint
    node.addEndpoint('number', {
        type: 'float',
        read: function(args, peer, cb) { cb(null, number); },
        write: function(value, peer, cb) {
            // write the internal state variable for `number` endpoint
            number = parseFloat(value);
            // signal successful write
            cb();
            // signal `number` value changed
            node.changed('number');
        }
    });

    // update number every 5 sec
    setInterval(() => { number++; node.changed('number'); }, 5000);
    
    // add an invokable endpoint
    node.addEndpoint('getLog', {
        type: 'invoke',
        invoke: function(args, peer, cb) {
            cb(null, { dataset: [{ x: 2, y: 45 }, { x: 5, y: 55 }], request: args, requestee: peer });
        }
    });
}

// create Motor instance to run
var motor = Motor();
