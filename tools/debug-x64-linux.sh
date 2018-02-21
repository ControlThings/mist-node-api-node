#Version of rebuild.sh for x64-linux

ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`

echo "Building for ${ARCH}" 
cd ../mist-c99; rm -rf build; rm libmist.a; make CC=gcc -f make-linux-static-library-x64.mk; cd ../tools;
cd ..; CC=clang CXX=clang node-gyp --debug rebuild; 
cd tools;
cp ../build/Debug/MistApi.node ../bin/MistApi-${ARCH}.node;

