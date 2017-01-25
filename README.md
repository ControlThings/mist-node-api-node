# Mist API

A native node.js plugin which uses the C99 Mist implementation. Currently working with Linux x86_64 and nodejs v6.x only. To get it working you need to run a Wish Core on the same host.

## Install 

```sh
npm install mist-api
```

## Example

```js
// Include the Mist
var Mist = require('mist-api').Mist;

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

// callback for invoke command sent to this device
mist.invoke('config', function(args, cb) {
    console.log("mist invoke:", args);

    // respond to request
    cb({ yo: [5,4], all: args });
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
