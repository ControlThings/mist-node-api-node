{
    "targets": [
        {
            "target_name": "NativeExtension",
            "sources": [ "src/NativeExtension.cc", "src/functions.cc" ],
            "include_dirs" : [
                                "src",
 	 			"<!(node -e \"require('nan')\")"
			]
        }
    ],
}