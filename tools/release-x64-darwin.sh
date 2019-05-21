#!/bin/bash

# Build script for compiling under macOS, or Darwin, as it known to those who are in the know

ARCH_VERSION=`node -e "console.log(process.arch + '-' + process.platform + '-' + process.version.split('.')[0])"`

echo "Building for ${ARCH_VERSION}" 
cd ../mist-c99; make -f make-static-library.mk clean; make CC=clang BUILD_TYPE=nodejs_plugin BUILD_FLAVOUR=release -f make-static-library.mk; cd ../tools;
cd ..; node-gyp --release rebuild; cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node; 
strip ../bin/MistApi-${ARCH_VERSION}.node
