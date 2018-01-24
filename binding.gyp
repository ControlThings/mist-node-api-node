{
    "targets": [
        {
            "target_name": "MistApi",
            "sources": [ "src/Mist.cc", "src/functions.cc", "src/Message.cc", "src/MistWrapper.cc" ],
            "cflags": [ "-O2" ],
            "cflags_cc": [ "-O2" ],
            "ldflags": [ ],
            "include_dirs" : [
                "src",
                "<!(node -e \"require('nan')\")",
                "mist-c99/src",
                "mist-c99/mist",
                "mist-c99/wish_app_deps",
                "mist-c99/wish_app_port_deps/unix",
                "mist-c99/wish_app",
                "mist-c99/wish",
                "mist-c99/deps/wish-rpc-c99/src",
                "mist-c99/deps/bson"
            ],
            "libraries": [
              "-lmist", "-L../mist-c99"
            ],
            "conditions": [
                [ 'OS!="win"', {
                    "cflags+": [ "-std=c++11" ],
                    "cflags_c+": [ "-std=c++11" ],
                    "cflags_cc+": [ "-std=c++11" ],
                }],
                [ 'OS=="mac"', {
                    "xcode_settings": {
                      "OTHER_CPLUSPLUSFLAGS" : [ "-std=c++11" ],
                      "OTHER_LDFLAGS": [ ],
                      "MACOSX_DEPLOYMENT_TARGET": "10.11"
                    },
                }],
            ],
        }
    ],
}
