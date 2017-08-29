#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 
cd ../mist-c99; make CC=gcc-4.8 -f make-linux-static-library-x64.mk; cd ../tools;
cd ..; CC=gcc-4.8 CXX=g++-4.8 node-gyp --debug rebuild ; cd tools; cp ../build/Debug/MistApi.node ../bin/MistApi-x64-linux.node 