cd ../mist-c99; rm -rf build; rm libmist.a; make -f make-linux-static-library-x64.mk; cd ../tools;
cd ..; node-gyp --debug rebuild; cd tools; cp ../build/Debug/MistApi.node ../bin/MistApi-x64-linux.node 
