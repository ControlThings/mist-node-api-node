# Release instructions for mist-api

The current build system must be run on Linux x64 to produce Linux
binaries, and macOSX to produce Darwin binaries. We must also compile
for each Node.js version separately.

Make sure that you have node.js 6, 8, and 10 installed (preferably the
latest LTS releases) and node-gyp installed on each one of them.

## For publish a new version on npmjs.org

1. On a Linux x64 system:

```sh
cd tools
./build-for-nodejs-versions.sh release-x64-linux.sh
./build-for-nodejs-versions.sh release-raspberry.sh
```

Note that the raspberry build requires arm-linux-gnueabihf
cross-compiling environment installed

2. On a macOS machine:

```sh
./build-for-nodejs-versions.sh release-x64-darwin.sh
```

3. Update version info


```sh
npm version patch
```

4. Publish to npmjs.org: 

You cannot `npm publish` directly, it will fail when installing package.
Something with the gypfile. 

Instead, run script in top-level directory:

```sh
./release-to-npmjs-org.sh
```

## Other useful things



