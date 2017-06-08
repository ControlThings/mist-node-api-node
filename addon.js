if (!process.version.substr(0, 3) === 'v6.') {
    console.log('MistApi is a native addon, which is not supported by Node.js version ('+process.version+'), requires v6.x.x., tested on v6.9.2.');
    process.exit(1);
}

var MistApi = null;

if (process.env.DEBUG) {
    MistApi = require('./build/Debug/MistApi.node').MistApi;
} else {
    if(process.env.BUILD) {
        MistApi = require('./build/Release/MistApi.node').MistApi;
    } else {
        var arch = process.arch;
        var platform = process.platform === 'darwin' ? 'osx' : process.platform;
        
        try {
            MistApi = require('./bin/MistApi-'+arch+'-'+platform+'.node').MistApi;
        } catch (e) {
            console.log('MistApi is a native addon, which is not supported or currently not bundled for your arch/platform ('+arch+'/'+platform+').');
            process.exit(1);
        }
    }
}

module.exports = MistApi;
