#Version of rebuild.sh for x64-linux

ARCH_VERSION=`node -e "console.log(process.arch + '-' + process.platform + '-' + process.version.split('.')[0])"`

echo "Building debug build for ${ARCH_VERSION}" 
# WARNING: Do not override CFLAGS here, as it will totally override definition mist-c99 makefile.
cd ../mist-c99; make -f make-static-library.mk clean; make CC=gcc BUILD_TYPE=nodejs_plugin BUILD_FLAVOUR=debug VERBOSE=1 -f make-static-library.mk; cd ../tools;

#cd ..; CC=clang CXX=clang node-gyp rebuild ; 
cd ..; CC=gcc CXX=g++ CXXFLAGS=-D_GLIBCXX_USE_CXX11_ABI=0 node-gyp --debug rebuild ; 
cd tools;
cp ../build/Debug/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node;


