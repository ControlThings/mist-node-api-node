#!/bin/bash

# This script takes as a parameter the platform-specific build-script.
# Then, for each version in list of node.js versions, activate version
# with nvm, and build.

if [ -z $1 ]; then
    echo Usage: $0 [platform-release-script]
    echo Example: $0 ./release-x64-linux.sh
    exit
fi

NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

NODEVERSIONS="6 8 10 12"

for x in $NODEVERSIONS; do
    if [ `nvm version $x` == "N/A" ]; then
        # nvm will print a descriptive error message
        echo Error: Node.js corresponding to major version $x is unavailable. Use 'nvm install'
        exit 1
    fi

    nvm exec $x bash $1
done

exit 0
