#Version of rebuild.sh for x64-linux

ARCH_VERSION=`node -e "console.log(process.arch + '-' + process.platform + '-' + process.version.split('.')[0])"`
#NODE_VERSION=`node -e "console.log(process.version.split('.')[0])"`

echo "Building for ${ARCH_VERSION}" 
cd ../mist-c99; rm -rf build; rm libmist.a; make CC=gcc CFLAGS="-DMIST_API_MAX_UIDS=512 -fPIC" -f make-linux-static-library-x64.mk; cd ../tools;
#cd ..; CC=clang CXX=clang node-gyp rebuild ; 
cd ..; CC=gcc CXX=g++ node-gyp rebuild ; 
cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node;
strip ../bin/MistApi-${ARCH_VERSION}.node;

