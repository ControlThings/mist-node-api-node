# Mist API

A native node.js plugin which uses the C99 Mist implementation.  Currently working with Linux x86_64 and nodejs v6, v8, v10. To get it working you need to run a Wish Core on the same host.

## Install 

```sh
npm install mist-api
```

## Example

```js
var MistNode = require('mist-api').MistNode;

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
    var interval = setInterval(() => { number++; node.changed('number'); }, 5000);
    
    // add an invokable endpoint
    node.addEndpoint('getLog', {
        type: 'invoke',
        invoke: function(args, peer, cb) {
            cb(null, { dataset: [{ x: 2, y: 45 }, { x: 5, y: 55 }], request: args, requestee: peer });
        }
    });
    
    this.shutdown = function() { clearInterval(interval); node.shutdown(); };
}

// create Motor instance to run
var motor = new Motor();

// clean shutdown:
//   motor.shutdown();
```

## Compiling the Mist API native library

The tools directory contains scripts (release- and debug-) which can be
used to compile for different platforms.

```
cd tools;
./release-x64-linux.sh
```

As the current node.js mist-api port uses an interface which depends on
node.js version, a separate library build is needed for each version of
node.js which is to be supported. There is a script for performing a
batch build for all platforms, tools/build-for-nodejs-versions.sh, which
takes individual release build scripts as argument:

```
cd tools;
build-for-nodejs-versions.sh release-x64-linux.sh
build-for-nodejs-versions.sh release-raspberry.sh
```




### Problems

#### node-gyp fails on c++ compile error  "class v8 has no member IsUint8Array" or similar

This occurs on hosts that have node.js 0.10.x installed as 'nodejs', and
node-gyp. Solution:

This usually occurs on a host with multiple node.js installations, or
if are on a host with an outdated system-wide installation of node.js
(Such as many slightly older Debian installations)

You should use Node version manager (NVM) to install node 6. https://github.com/creationix/nvm 

Then you should switch your session to using node.js 6.x, 8, or 10
and install node-gyp to that instance of node.js:
```
nvm use 6
npm i -g node-gyp 
```
