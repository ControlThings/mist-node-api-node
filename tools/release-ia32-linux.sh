#!/bin/bash

# Release script for cross-compiling for ia32 platform (ia32-linux)

ARCH_VERSION=`node -e "console.log('ia32-linux-' + process.version.split('.')[0])"`

echo "Cross-building for ${ARCH}" 

cd ../mist-c99; make -f make-static-library.mk clean; make CC=gcc APPEND_CFLAGS="-m32 -std=gnu99"  BUILD_TYPE=nodejs_plugin BUILD_FLAVOUR=release -f make-static-library.mk; cd ../tools;
cd ..; CC=gcc CXX=g++ node-gyp --release rebuild --arch=ia32; 
cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node;
strip ../bin/MistApi-${ARCH_VERSION}.node;

