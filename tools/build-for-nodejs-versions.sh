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

NODEVERSIONS="6 8 10"

for x in $NODEVERSIONS; do
    nvm_return=`nvm use $x|grep "Now using"`
    if [ -z "$nvm_return" ]; then
        # nvm will print a descriptive error message
        exit 1
    fi
    bash $1
done

exit 0
