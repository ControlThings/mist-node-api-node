# Mist API

A native node.js plugin which uses the C99 Mist implementation. Currently able to build for Linux (desktop and raspberry) and OSX. Requires a Wish Core running on localhost.

## Building (see Releasing for Release steps)

Set the environment variable `BUILD=1`  to use the `build/Release/MistApi.node` instead of prebuilt binaries.

Currently required: `nodejs v6.9.2` (has correct libuv)

### Build (Linux desktop and OSX):

1. Make a link from package root folder to mist_esp root.
2. First build the `linux-static-library.mk` in mist-esp.
3. Build this addon `node-gyp rebuild --release`
4. Run using `BUILD=1 node tools/sandbox.js` and `BUILD=1 node tools/run.js` 
5. If it does nothing interesting, you are probably not running a Wish Core with an app-interface on port `9094`.

### Build (Crosscompile for Raspberry pi)

#### First build the libmist.a from mist-esp:

```sh
sudo apt-get install build-essential
sudo apt-get install g++-arm-linux-gnueabihf
sudo apt-get install gdb-multiarch

make -f linux-arm-static-library.mk
```

#### Build the node.js plugin

```sh
CC=arm-linux-gnueabihf-gcc-4.8 CXX=arm-linux-gnueabihf-g++-4.8 node-gyp clean configure --arch=arm rebuild
```

#### On the PI: 

  http://nodejs.org/dist/latest-v6.x/node-v6.9.2-linux-armv6l.tar.gz

## Releasing

1. The static library must be built with -fvisibility=hidden. 
2. Build as explained in the Building-section. 
3. Strip the resulting .node file
4. Verify there are no unnecessary mist, wish, bson and sandbox symbols. (`readelf -sW result.node`)

## Known issues

* Memory leaks in message queue
* Input buffer is not a ring, but a single 1MiB block, fails horribly at the end

