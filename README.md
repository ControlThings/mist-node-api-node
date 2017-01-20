# Mist Node API

A native node.js plugin which uses the C99 Mist implementation. Currently working with Linux and OSX.

## Install 

```sh
npm install mist-node-api
```

## Example

```js
// Include the Mist
var Mist = require('mist-node-api').Mist;

// Initialize Mist
var mist = new Mist();

// Initialize a model
var model = {
    device: "Joystick",
    model: {
        axis0: {
            label: "Axis (left/right)",
            type: "float",
            scale: "100",
            unit: "%",
            read: true
        },
        axis1: {
            label: "Axis (up/down)",
            type: "float",
            scale: "100",
            unit: "%",
            read: true
        },
        button0: {
            label: "Button 1",
            type: "bool",
            data: false
        },
        button1: {
            label: "Button 2",
            type: "bool",
            data: false,
            write: true // just to demonstrate 
        }
    }
}

;

// callback for write commands sent to this device
mist.write(function(endpoint, value) {
    console.log("mist write:", endpoint, value);
});

// Initialize Mist device
mist.create(model);

// button state variable
var button0 = false;

var interval = setInterval(function() {
    // toggle button state
    button0 = !button0;
    // use sine wave for axis 
    var axis0 = Math.sin(Date.now()/4000);

    // update the values in Mist
    mist.update('axis0', axis0);
    mist.update('axis1', Math.round(axis0));
    mist.update('button0', button0);
}, 300);
```

## Building (see Releasing for Release steps)

Set the environment variable `BUILD=1`  to use the `build/Release/MistApi.node` instead of prebuilt binaries.

### Build (Linux desktop):

  node node_modules/node-gyp/bin/node-gyp.js rebuild --thin=yes --release --silly

### Build (Crosscompile for Raspberry pi)

### First build the libmist.a from mist-esp:

sudo apt-get install build-essential
sudo apt-get install g++-arm-linux-gnueabihf
sudo apt-get install gdb-multiarch

make -f linux-arm-static-library.mk

### Build the node.js plugin

CC=arm-linux-gnueabihf-gcc-4.8 CXX=arm-linux-gnueabihf-g++-4.8 node-gyp clean configure --arch=arm rebuild


### On the PI: 

  http://nodejs.org/dist/latest-v6.x/node-v6.9.2-linux-armv6l.tar.gz

## Releasing

1. The static library must be built with -fvisibility=hidden. 
2. Build as explained in the Building-section. 
3. Strip the resulting .node file
4. Verify there are no unnecessary mist, wish, bson and sandbox symbols. (`readelf -sW result.node`)

## Known issues

* Memory leaks in message queue
* Input buffer is not a ring, but a single 1MiB block, fails horribly at the end

