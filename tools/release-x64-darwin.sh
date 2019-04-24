ARCH_VERSION=`node -e "console.log(process.arch + '-' + process.platform + '-' + process.version.split('.')[0])"`

echo "Building for ${ARCH_VERSION}" 
cd ../mist-c99; rm -rf build; rm libmist.a; make -f make-linux-static-library-x64-darwin.mk; cd ../tools;
cd ..; node-gyp --release rebuild; cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH_VERSION}.node; 
strip ../bin/MistApi-${ARCH_VERSION}.node
