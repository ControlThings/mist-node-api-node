const https = require('https');
const fs = require('fs');
const child = require('child_process');

var testStartTime = Date.now();

var wishBinaryUrl = 'https://mist.controlthings.fi/dist/wish-core-v0.6.6-stable3-linux-x64';

function done() {
    
    console.log('Starting Wish Core.');
    var core = child.spawn('./wish-core', [], { cwd: './env' });
    
    function running() {
        console.log('Starting node.');
        var node = child.spawn('node', ['./run.js']);

        node.on('error', (err) => {
            process('Failed to start node process.');
        });

        node.stdout.on('data', (data) => {
            console.log('\x1b[37mnode>', data.toString().trim());
        });

        node.on('exit', (code, signal) => {
            console.log('\x1b[36mnode> Exited with code:', signal ? signal : code);
        });

        var results = [];

        function run(list) {
            if (list.length > 0) {
                var file = list.pop();
            } else {
                console.log("We're all done.", list);

                console.log('\n\x1b[34m\x1b[1mSuccesses\x1b[22m');

                for(var i in results) {
                    for(var j in results[i].passes) {
                        var it = results[i].passes[j];
                        console.log('  \x1b[34m✓ \x1b[37m', it.fullTitle, '\x1b[32m('+it.duration+'ms)');
                    }
                    console.log();
                }

                var failures = false;

                for(var i in results) {
                    for(var j in results[i].failures) {
                        failures = true;
                    }
                }
                
                if (failures) {
                
                    console.log('\n\x1b[1mFailures\x1b[22m');

                    for(var i in results) {
                        for(var j in results[i].failures) {
                            var it = results[i].failures[j];
                            console.log('  \x1b[31m✗ \x1b[38m', it.fullTitle, '\x1b[32m('+it.duration+'ms)');

                            console.log();
                            console.log('      \x1b[35m\x1b[1m'+it.err.message+'\x1b[22m');
                            console.log('        '+it.err.stack.replace(/\n/g, '\n        '));
                        }
                        console.log();
                    }
                }

                console.log();

                //fs.writeFileSync('./results.json', JSON.stringify(results, null, 2));
                node.kill();
                core.kill();
                coreBob.kill();
                return;
            }

            var testFile = './test/'+file;
            console.log('\x1b[34mStarting test:', testFile);
            var test = child.spawn('../node_modules/mocha/bin/mocha', ['--reporter', 'json', '-c', testFile]);

            test.on('error', (err) => {
                console.log('\x1b[36mtest> Failed to start test process.');
            });

            test.stdout.on('data', (data) => {
                try {
                    results.push(JSON.parse(data));
                } catch(e) {
                    console.log('\x1b[36mtest>', data.toString().trim());
                }                
            });

            test.stderr.on('data', (data) => {
                console.log('\x1b[36mtest>', data.toString().trim());
            });

            test.on('exit', (code, signal) => {
                console.log('\x1b[36mtest> Exited with code:', code, signal);
                if( code === 0 ) {
                    console.log('\x1b[35mTest run completed successfully in '+(Date.now()-testStartTime)+'ms');
                }
                
                process.nextTick(function() { run(list); });
            });            
        }

        var list = [];
        const testFolder = './test/';
        const fs = require('fs');
        fs.readdir(testFolder, (err, files) => {
            files.forEach(file => {
                if(file.endsWith('.js')) {
                    list.push(file);
                }
            });
            
            run(list);
        });
        
        
    }
    
    var coreTimeout = setTimeout(() => { running(); }, 200);
    
    core.on('error', (err) => {
        console.log('\x1b[35mwish> Failed to start wish-core process.');
        clearTimeout(coreTimeout);
    });
    
    core.stdout.on('data', (data) => {
        console.log('\x1b[35mwish>', data.toString().trim());
    });
    
    core.stderr.on('data', (data) => {
        console.log('wish>', data.toString().trim());
    });
    
    core.on('exit', (code) => {
        console.log("wish exited with code:", code);
        clearTimeout(coreTimeout);
    });
    
    function runningBob() {
        
    }
    
    console.log('Starting Wish Core for Bob.');
    var coreBob = child.spawn('./wish-core', ['-p 38001', '-a 9096'], { cwd: './env/bob' });
    
    var coreBobTimeout = setTimeout(() => { runningBob(); }, 200);
    
    coreBob.on('error', (err) => {
        console.log('\x1b[35mwish> Failed to start wish-core process.');
        clearTimeout(coreBobTimeout);
    });
    
    coreBob.stdout.on('data', (data) => {
        console.log('\x1b[35mwish>', data.toString().trim());
    });
    
    coreBob.stderr.on('data', (data) => {
        console.log('wish>', data.toString().trim());
    });
    
    coreBob.on('exit', (code) => {
        console.log("wish exited with code:", code);
        clearTimeout(coreBobTimeout);
    });
}

try {
    //fs.unlinkSync('./env/wish_hostid.raw');
    //fs.unlinkSync('./env/wish_id_db.bson');
} catch (e) {}

https.get(wishBinaryUrl, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    
    var downloadTime = Date.now();

    var fileName = './env/wish-core';
    var file = fs.createWriteStream(fileName);

    if (res.statusCode === 200) {
        file.on('close', () => { console.log('Downloaded Wish binary '+(Date.now()-downloadTime)+'ms'); fs.chmodSync(fileName, '755'); done(); });
        res.pipe(file);
    } else if ( res.statusCode === 404 ) {
        console.error('Wish binary not found '+wishBinaryUrl);
    } else {
        console.error('Failed downloading Wish binary '+wishBinaryUrl+'. HTTP response code', res.statusCode);
    }
}).on('error', (e) => {
    console.error('Failed downloading wish binary.', e);
});


