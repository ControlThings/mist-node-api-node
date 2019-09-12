# Compiling the Mist API native library

The native library must currently be build for each node.js version separately: 6, 8, and 10.

## Debug versions

Debug versions can be build using the script:

```
cd tools;
./debug-build.sh
```

This results in a debug build, that is a version built with '-g' options to include debug symbols, and no RELEASE_BUILD defined, so all debug print outs are included. 

The library is built against the currently active node.js version, so check that with `node -v`. 

The library is in build/Debug/, and will be used by `addon.js` if DEBUG=1 environment variable is defined. 

## Building release versions

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
