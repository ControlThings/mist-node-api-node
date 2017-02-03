const https = require('https');
const fs = require('fs');
const child = require('child_process');

var testStartTime = Date.now();

var wishBinaryUrl = 'https://mist.controlthings.fi/dist/wish-core-v0.6.6-stable3-linux-x64';

function done() {
    
    console.log('Starting Wish Core.');
    var core = child.spawn('./env/wish-core');
    
    function running() {
        console.log('Starting node.');
        var node = child.spawn('node', ['./run.js']);

        node.on('error', (err) => {
            process('Failed to start node process.');
        });

        node.stdout.on('data', (data) => {
            console.log('\x1b[37mnode>', data.toString().trim());
        });

        node.on('exit', function(code, signal) {
            console.log('\x1b[36mnode> Exited with code:', signal ? signal : code);
        });

        console.log('Starting test.');
        var test = child.spawn('node', ['./sandbox.js']);

        test.on('error', (err) => {
            process('Failed to start test process.');
        });

        test.stdout.on('data', (data) => {
            console.log('\x1b[36mtest>', data.toString().trim());
        });
        
        test.on('exit', function(code, signal) {
            console.log('\x1b[36mtest> Exited with code:', code, signal);
            if( code === 0 ) {
                console.log('\x1b[35mTest run completed successfully in '+(Date.now()-testStartTime)+'ms');
            }
            node.kill();
            core.kill();
        });
    }
    
    var coreTimeout = setTimeout(function() { running(); }, 200);
    
    core.on('error', (err) => {
        console.log('\x1b[35mwish> Failed to start wish-core process.');
    });
    
    core.stdout.on('data', (data) => {
        console.log('\x1b[35mwish>', data.toString().trim());
    });
    
    core.stderr.on('data', (data) => {
        console.log('wish>', data.toString().trim());
    });
    
    core.on('exit', function(code) {
        console.log("wish exited with code:", code);
        clearTimeout(coreTimeout);
    });
}

https.get(wishBinaryUrl, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);

    var fileName = './env/wish-core';
    var file = fs.createWriteStream(fileName);

    if (res.statusCode === 200) {
        file.on('close', function() { fs.chmodSync(fileName, '755'); done(); });
        res.pipe(file);
    } else if ( res.statusCode === 404 ) {
        console.error('Wish binary not found '+wishBinaryUrl);
    } else {
        console.error('Failed downloading Wish binary '+wishBinaryUrl+'. HTTP response code', res.statusCode);
    }
}).on('error', (e) => {
    console.error('Failed downloading wish binary.', e);
});

