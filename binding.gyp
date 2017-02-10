{
    "targets": [
        {
            "target_name": "MistApi",
            "sources": [ "src/NativeExtension.cc", "src/functions.cc", "src/Message.cc", "src/StreamingWorker.cc", "src/StreamingWorkerWrapper.cc" ],
            "cflags": [ "-g -O0" ],
            "cflags_cc": [ "-g -O0" ],
            "ldflags": [ ],
            "include_dirs" : [
                "src",
                "<!(node -e \"require('nan')\")",
                "mist-esp/apps/mist-api",
                "mist-esp/wish_app_deps",
                "mist-esp/wish_app",
                "mist-esp/wish_rpc",
                "mist-esp/mist",
                "mist-esp/deps/bson",
                "mist-esp/deps/cBSON"
            ],
            "libraries": [
              "-lmist", "-L/home/akaustel/work/wh/mist-esp"
            ],
        }
    ],
}
