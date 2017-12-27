#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 

#ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`
ARCH="ia32-linux"

echo "Building for ${ARCH}" 
export CFLAGS=-m32
cd ../mist-c99; rm -rf build; rm libmist.a; make CC=gcc-4.8 -f make-linux-static-library-ia32.mk; cd ../tools;
cd ..; CC=gcc-4.8 CXX=g++-4.8 node-gyp --release rebuild --arch=ia32; 
cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH}.node;
strip ../bin/MistApi-${ARCH}.node;

