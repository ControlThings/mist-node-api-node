# The Mist test suite

The Mist tests is in tools/test directory. The tests are run through the
`test-suite.js` script in the tools directory.

The test suite reads a couple of environment variables:

WISH    The path to the wish-core executable to be used in the tests
DEBUG   Set to 1 in order for addon.js to load the Debug version of the
mist-api libraries.

The test-suite.js script takes as optional argument the name of the test
to run. If none is given, then all the tests in tools/test are run.

The test-suite.js stores the environment under tools/env. It is a good
idea to remove this directory prior to running tests, so that the test
is started from a "clean" environment.

## Example invocation

This runs the `mist-model-from-json.js` test with release code:

```sh
cd tools
rm -rf env/; WISH=~/controlthings/mist/wish-c99/build/wish-core node test-suite.js test/mist-model-from-json.js
```

When developing, you might want to first build a debug build, and then run the test suite using the debug libs:

```sh
cd tools
./debug-build.sh
rm -rf env/; WISH=~/controlthings/mist/wish-c99/build/wish-core DEBUG=1 node test-suite.js test/mist-model-from-json.js
```

## Running gdb and valgrind with the test framework

See the script `test-suite.js`, it has options for starting wish-core and the node process under gdb or Valgrind.