#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 

#ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`
ARCH="arm-linux"
ARCH_VERSION=`node -e "console.log('arm-linux-' + process.version.split('.')[0])"`

echo "Building for ${ARCH}" 
cd ../mist-c99; rm -rf build; rm libmist.a; make CC=arm-linux-gnueabihf-gcc -f make-linux-static-library-arm.mk; cd ../tools;
cd ..; 
CC=arm-linux-gnueabihf-gcc CXX=arm-linux-gnueabihf-g++ node-gyp rebuild --arch=armv7; 
cd tools; 
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node; 
arm-linux-gnueabihf-strip ../bin/MistApi-${ARCH_VERSION}.node; 

