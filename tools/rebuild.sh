cd ../mist-c99; make -f make-linux-static-library-x64.mk; cd ../tools;
cd ..; node-gyp rebuild; cd tools; cp ../build/Release/MistApi.node ../bin/MistApi-x64-linux.node 
