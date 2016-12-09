{
    "targets": [
        {
            "target_name": "MistApi",
            "sources": [ "src/NativeExtension.cc", "src/functions.cc" ],
            "cflags": [ "-O2" ],
            "cflags_cc": [ "-O2" ],
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
