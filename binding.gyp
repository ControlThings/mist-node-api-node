{
    "targets": [
        {
            "target_name": "NativeExtension",
            "sources": [ "src/NativeExtension.cc", "src/functions.cc" ],
            "cflags": [ "-O2",  "-fvisibility=hidden", "-flto", "-fwhole-program", "-Wno-unused-variable", "-ffunction-sections", "-fdata-sections" ],
            "cflags_cc": [ "-O2",  "-fvisibility=hidden", "-flto", "-fwhole-program", "-Wno-unused-variable", "-ffunction-sections", "-fdata-sections" ],
            "cflags!": [ "-fvisibility=default" ],
            "ldflags": [ "-Wl,--gc-sections", "-Wl,--exclude-libs,ALL", "-Wl,-flto" ],
            "include_dirs" : [
                "src",
                "<!(node -e \"require('nan')\")",
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
