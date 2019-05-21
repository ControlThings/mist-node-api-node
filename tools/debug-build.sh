#!/bin/bash

# Build a debug build. 
# The build script uses CC and CXX environment variables. If they are not defined, gcc and g++ are defaulted to.
# 
# Example on Linux: CC=gcc CXX=g++ ./debug-x64-linux.sh
# Example on macOS: CC=clang CXX=clang ./debug-x64-linux.sh
# 
# To use the MistApi debug build, specify DEBUG=1 env variable (see addon.js)
#

ARCH_VERSION=`node -e "console.log(process.arch + '-' + process.platform + '-' + process.version.split('.')[0])"`

if [ -z $CC ]; then CC=gcc; fi

if [ -z $CXX ]; then CXX=g++; fi

echo "Building debug build for ${ARCH_VERSION}" 
# WARNING: Do not override CFLAGS here, as it will totally override definition mist-c99 makefile.
cd ../mist-c99; make -f make-static-library.mk clean; make CC=$CC BUILD_TYPE=nodejs_plugin BUILD_FLAVOUR=debug VERBOSE=1 -f make-static-library.mk; cd ../tools;

cd ..; CC=$C CXX=$CXX node-gyp --debug rebuild ; 
cd tools;

# The library is in build/Debug/MistApi.node