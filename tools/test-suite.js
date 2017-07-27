const https = require('https');
const fs = require('fs');
const mkdirp = require('mkdirp');
const child = require('child_process');

var testStartTime = Date.now();

var wishBinaryUrl = 'https://mist.controlthings.fi/dist/wish-core-v0.8.0-alpha-x64-linux';

function done() {

    //console.log('Starting Wish Core.');
    
    // To debug errors in Alice core C/C++ code enable the below core = child.spawn('gdb', ...
    var core = child.spawn('./wish-core', [], { cwd: './env', stdio: 'inherit' });
    //var core = child.spawn('gdb', ['-batch', '-ex', 'run', '-ex', 'bt', './wish-core'], { cwd: './env', stdio: 'inherit' });

    function running() {
        //console.log('Starting node.');
        
        var results = [];

        function run(list) {
            if (list.length > 0) {
                var file = list.pop();
            } else {
                //console.log("test-suite.js: We're all done.", list);

                console.log('\n\x1b[34m\x1b[1mSuccesses\x1b[22m');
                
                var successCount = 0;
                var failCount = 0;

                for(var i in results) {
                    for(var j in results[i].passes) {
                        var it = results[i].passes[j];
                        successCount++;
                        console.log('  \x1b[34m✓ \x1b[37m', it.fullTitle, '\x1b[32m('+it.duration+'ms)','\x1b[39m');
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
                            failCount++;
                            
                            console.log('  \x1b[31m✗ \x1b[38m', it.fullTitle, '\x1b[32m('+it.duration+'ms)');

                            console.log();
                            console.log('      \x1b[35m\x1b[1m'+it.err.message+'\x1b[22m');
                            console.log('        '+it.err.stack.replace(/\n/g, '\n        '));
                        }
                        console.log();
                    }
                }

                console.log('Success / Fail / Total:', successCount, '/', failCount, '/', successCount + failCount);
                console.log('\x1b[39m');

                //fs.writeFileSync('./results.json', JSON.stringify(results, null, 2));
                core.kill();
                coreBob.kill();
                return;
            }

            var testFile = file;
            console.log('\x1b[34mStarting test:', testFile);
            

            // To debug errors in test C/C++ code enable the below bobCore = child.spawn('gdb', ...
            
            var test = child.spawn('../../node_modules/mocha/bin/mocha', ['--reporter', 'json', '-c', '../'+testFile], { cwd: './env' });
            //var test = child.spawn('gdb', ['-batch', '-ex', 'set follow-fork-mode child', '-ex', 'run ../node_modules/mocha/bin/mocha --reporter json -c '+testFile, '-ex', 'bt', 'node']);

            test.on('error', (err) => {
                console.log('\x1b[36m'+testFile+'> Failed to start test process.');
            });

            test.stdout.on('data', (data) => {
                try {
                    results.push(JSON.parse(data));
                    //console.log("======="+data);
                } catch(e) {
                    console.log('\x1b[36m'+testFile+'>', data.toString().trim(),'\x1b[39m');
                }                
            });

            test.stderr.on('data', (data) => {
                console.log('\x1b[36m'+testFile+'>', data.toString().trim(),'\x1b[39m');
            });

            test.on('exit', (code, signal) => {
                if( code === 0 ) {
                    console.log('\x1b[35mTest run completed successfully in '+(Date.now()-testStartTime)+'ms','\x1b[39m');
                } else {
                    console.log('\x1b[36m'+testFile+'> Exited with error code:', code, signal,'\x1b[39m');
                }
                
                process.nextTick(function() { run(list); });
            });            
        }

        if (process.argv[2]) {
            //console.log("testing:", process.argv[2]);
            run([process.argv[2]]);
        } else {
            var list = [];
            const testFolder = './test/';
            const fs = require('fs');
            fs.readdir(testFolder, (err, files) => {
                files.forEach(file => {
                    if(file.endsWith('.js')) {
                        list.push(testFolder+file);
                    }
                });

                run(list);
            });
        }        
        
    }

    var coreTimeout = setTimeout(() => { running(); }, 200);
    
    core.on('error', (err) => {
        console.log('\x1b[35mwish> Failed to start wish-core process.');
        clearTimeout(coreTimeout);
    });
    /*
    core.stdout.on('data', (data) => {
        console.log('\x1b[35mwish>', data.toString().trim());
    });
    
    core.stderr.on('data', (data) => {
        console.log('wish>', data.toString().trim());
    });
    */
    
    core.on('exit', (code) => {
        if (code !== 0) { console.log("wish exited with code:", code); }
        clearTimeout(coreTimeout);
    });
    
    function runningBob() {

    }
    
    //console.log('Starting Wish Core for Bob.');
    
    
    // To debug errors in Bob's core enable the below bobCore = child.spawn('gdb', ...
    
    //var coreBob = child.spawn('../wish-core', ['-p 38002', '-a 9096', '-b', '-l', '-r', '-s'], { cwd: './env/bob', stdio: 'inherit' });
    var coreBob = child.spawn('gdb', ['-batch', '-ex', 'run -p 38002 -a 9096 -b -l -r -s', '-ex', 'bt', '../wish-core'], { cwd: './env/bob', stdio: 'inherit' });
    
    var coreBobTimeout = setTimeout(() => { runningBob(); }, 200);
    
    coreBob.on('error', (err) => {
        console.log('\x1b[35mwish> Failed to start wish-core process for bob.', err,'\x1b[39m');
        clearTimeout(coreBobTimeout);
        
        core.kill();
        coreBob.kill();
        
        process.exit(0);
    });
    
    /*
    coreBob.stdout.on('data', (data) => {
        console.log('\x1b[35mwish>', data.toString().trim());
    });
    
    coreBob.stderr.on('data', (data) => {
        console.log('wish>', data.toString().trim());
    });
    */
    
    coreBob.on('exit', (code) => {
        //if ( code !== null ) { console.log("wish (bob) exited with code:", code); }
        console.log("wish (bob) exited with code:", code);
        clearTimeout(coreBobTimeout);
    });
}

function start() {


    try {
        //fs.unlinkSync('./env/wish_hostid.raw');
        //fs.unlinkSync('./env/wish_id_db.bson');
    } catch (e) {}

    var fileName = './env/wish-core';
    mkdirp.sync('./env/alice');
    mkdirp.sync('./env/bob');

    if (process.env.WISH) {
        try {
            fs.writeFileSync(fileName, fs.readFileSync(process.env.WISH));
            fs.chmodSync(fileName, '755');
        } catch(e) {
            console.log('Could not find Wish binary from WISH='+process.env.WISH, e);
            process.exit(0);
            return;
        }
        done();
    } else {

        https.get(wishBinaryUrl, (res) => {
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers);

            var downloadTime = Date.now();

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

    }
}
/*
child.exec('rm -r ./env', function (err, stdout, stderr) {
    if (err) { 
        console.log("Failed to remove the working directory './env' using rm -r ./env, trying to run tests anyway"); 
        setTimeout(start, 2000);
        return;
    }
    
    start();
});
*/

start();