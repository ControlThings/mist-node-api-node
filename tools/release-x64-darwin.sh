ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`

echo "Building for ${ARCH}" 
cd ../mist-c99; rm -rf build; rm libmist.a; make -f make-linux-static-library-x64-darwin.mk; cd ../tools;
cd ..; node-gyp --release rebuild; cd tools;
cp ../build/Release/MistApi.node ../bin/MistApi-${ARCH}.node; 
strip ../bin/MistApi-${ARCH}.node
