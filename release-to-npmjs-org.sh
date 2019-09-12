#/usr/bin/sh

# Workaround for publishing withuot npm adding gypfile: true
# 
#
# $ npm adduser --reg https://registry.npmjs.org/
# Username: redacted
# Password: 
# Email: (this IS public) redacted.redacted@controlthings.fi
# Logged in as redacted on https://registry.npmjs.org/.
# $ npm publish --reg https://registry.npmjs.org/


mv binding.gyp binding.tgz

npm publish --reg https://registry.npmjs.org/

mv binding.tgz binding.gyp

