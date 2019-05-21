#!/bin/bash

# Release script for cross-compiling for Raspberry platform (arm-linux)

ARCH_VERSION=`node -e "console.log('arm-linux-' + process.version.split('.')[0])"`

echo "Cross-building for ${ARCH}" 
cd ../mist-c99; make -f make-static-library.mk clean; make CC=arm-linux-gnueabihf-gcc BUILD_TYPE=nodejs_plugin BUILD_FLAVOUR=release -f make-static-library.mk; cd ../tools;
cd ..; 
CC=arm-linux-gnueabihf-gcc CXX=arm-linux-gnueabihf-g++ CXXFLAGS=-D_GLIBCXX_USE_CXX11_ABI=0 node-gyp rebuild --arch=armv7; 
cd tools; 
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node; 
arm-linux-gnueabihf-strip ../bin/MistApi-${ARCH_VERSION}.node; 

