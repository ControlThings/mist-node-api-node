{
    "targets": [
        {
            "target_name": "MistApi",
            "sources": [ "src/NativeExtension.cc", "src/Mist.cc", "src/functions.cc", "src/Message.cc", "src/StreamingWorker.cc", "src/MistWrapper.cc" ],
            "cflags": [ "-g -O0" ],
            "cflags_cc": [ "-g -O0" ],
            "ldflags": [ ],
            "include_dirs" : [
                "src",
                "<!(node -e \"require('nan')\")",
                "mist-c99/src",
                "mist-c99/mist",
                "mist-c99/wish_app_deps",
                "mist-c99/wish_app",
                "mist-c99/deps/wish-rpc-c99/src",
                "mist-c99/deps/bson",
                "mist-c99/deps/cbson/src"
            ],
            "libraries": [
              "-lmist", "-L/home/akaustel/work/mist/mist-c99"
            ],
        }
    ],
}
