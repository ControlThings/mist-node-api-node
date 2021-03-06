/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
var WishApp = require('../../index.js').WishApp;
var Mist = require('../../index.js').Mist;
var MistNode = require('../../index.js').MistNode;
var Sandboxed = require('../../index.js').Sandboxed;
var bson = require('bson-buffer');
var BSON = new bson();
var inspect = require('util').inspect;
var util = require('./deps/util.js');

var srcApp;
var dstApp;
var requestorApp;

var aliceIdentity;
var bobIdentity;
var charlieIdentity;

var bobWldEntry;
var charlieWldEntry;

/*
 * Test for correct closing of parallel (redundant) connections.
 * FIXME this test is too simple, think of a better scenario. For example, nothing ensures that the cores actually try to make several connections to each other.
 * This test correctly tests the correct situation only if it so happens that the cores make symmetric connections to each other. This is in no way ensured by the test. 
 * 
 * @returns {undefined}
 */

describe('Wish parallel connection reaper', function () {
    var srcMist;
    var dstMist;
    var requestorMist;

    before(function (done) {
        console.log('before 1');
        requestorApp = new WishApp({name: 'control app', protocols: ['test'], corePort: 9095}); // , protocols: [] });

        setTimeout(done, 200);
    });

    before(function (done) {
        console.log('before 2');
        srcApp = new WishApp({name: 'app1', protocols: ['test'], corePort: 9096}); // , protocols: [] });

        srcApp.once('ready', function () {
            done();
        });
    });

    before(function (done) {
        console.log('before 3');
        dstApp = new WishApp({name: 'app2', protocols: ['test'], corePort: 9097}); // , protocols: [] });

        dstApp.once('ready', function () {
            done();
        });
    });

    before(function (done) {
        util.clear(requestorApp, done);
    });

    before(function (done) {
        util.clear(srcApp, done);
    });

    before(function (done) {
        util.clear(dstApp, done);
    });

    var name1 = 'Alice';

    before(function (done) {
        util.ensureIdentity(requestorApp, name1, function (err, identity) {
            if (err) {
                done(new Error('util.js: Could not ensure identity.'));
            }
            aliceIdentity = identity;
            done();
        });
    });

    var name2 = 'Bob';

    before(function (done) {
        util.ensureIdentity(srcApp, name2, function (err, identity) {
            if (err) {
                done(new Error('util.js: Could not ensure identity.'));
            }
            bobIdentity = identity;
            done();
        });
    });

    var name3 = 'Charlie';
    before(function (done) {
        util.ensureIdentity(dstApp, name3, function (err, identity) {
            if (err) {
                done(new Error('util.js: Could not ensure identity.'));
            }
            charlieIdentity = identity;
            done();
        });
    });

    before(function (done) {
        // wait for relay connections to init
        setTimeout(function () {
            done();
        }, 200);
    });


    before(function (done) {
        requestorMist = new Mist({name: 'Requestor Mist', coreIp: '127.0.0.1', corePort: 9095});

        setTimeout(function () {
            requestorMist.request('ready', [], function (err, ready) {
                if (ready) {
                    console.log("==============================requestorMist ready")
                    requestorMist.request('signals', [], function (err, data) {
                        if (err) {
                            console.log("err: ", err);
                            return;
                        }
                        console.log("requestorMist signal: ", data);
                    });
                    done();
                } else {
                    console.log('ready', arguments);
                    done(new Error('MistApi not ready, bailing.'));
                }

            });
        }, 200);
    });

    before(function (done) {
        node = new MistNode({name: 'src Node', coreIp: '127.0.0.1', corePort: 9096});
        node.create({
            output: {label: 'output', type: 'bool', read: true, write: true}
        });

        node.write('output', function (value, peer, cb) {
            console.log('write:', value);
            cb();
        });

        setTimeout(done, 100);

    });

    before(function (done) {
        node = new MistNode({name: 'dst Node', coreIp: '127.0.0.1', corePort: 9097});
        node.create({
            input: {label: 'input', type: 'bool', read: true, write: true}
        });

        node.write('input', function (value, peer, cb) {
            console.log('write:', value);
            cb();
        });

        setTimeout(done, 100);

    });


    it('Alice should find Bob in wld', function (done) {
        this.timeout(35000);



        function poll() {
            requestorApp.request('wld.list', [], function (err, data) {
                if (err) {
                    return done(new Error(inspect(data)));
                }

                //console.log("Bobs wld", err, data);

                for (var i in data) {
                    if (Buffer.compare(data[i].ruid, bobIdentity.uid) === 0) {
                        bobWldEntry = data[i];
                        done();
                        return;
                    }
                }

                setTimeout(poll, 1000);
            });
        }
        ;

        setTimeout(poll, 100);
    });

    it('should add Bob as a friend to Alice', function (done) {
        console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);

        requestorApp.request('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }

            setTimeout(done, 1000);
        });
    });

    it('Bob should accept friend request from Alice and switch should become visible', function (done) {
        this.timeout(10000);

        var signals = requestorMist.request('signals', [], function (err, data) {
            if (signals == 0) {
                return;
            }
            if (data === 'peers' || data[0] === 'peers') {
                console.log("Requestor Mist peers")
                requestorMist.requestCancel(signals);
                signals = 0;
                requestorMist.request('wish.identity.list', [], function (err, data) {
                    if (err) {
                        return;
                    }
                    console.log("mistapi: wish.identity.list ", data);

                })
                done();
                done = function() {};
            }
        });


        srcApp.request('identity.friendRequestList', [], function (err, data) {
            console.log('srcApp friendRequestList:', err, data);
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list!'));
            }

            srcApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function (err, data) {
                console.log('srcApp friendRequestAccept:', err, data);
            });
        });
    });

    it('Alice should find Charlie in wld', function (done) {
        this.timeout(35000);



        function poll() {
            requestorApp.request('wld.list', [], function (err, data) {
                if (err) {
                    return done(new Error(inspect(data)));
                }

                //console.log("Bobs wld", err, data);

                for (var i in data) {
                    if (Buffer.compare(data[i].ruid, charlieIdentity.uid) === 0) {
                        charlieWldEntry = data[i];
                        done();
                        return;
                    }
                }

                setTimeout(poll, 1000);
            });
        }
        ;

        setTimeout(poll, 100);
    });

    it('should add Charlie as a friend to Alice', function (done) {
        console.log("Friend request params:", [aliceIdentity.uid, charlieWldEntry.ruid, charlieWldEntry.rhid]);

        requestorApp.request('wld.friendRequest', [aliceIdentity.uid, charlieWldEntry.ruid, charlieWldEntry.rhid], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }

            setTimeout(done, 1000);
        });
    });

    it('Charlie should accept friend request from Alice and switch should become visible', function (done) {
        this.timeout(10000);
        var signals = requestorMist.request('signals', [], function (err, data) {
            if (data === 'peers' || data[0] === 'peers') {
                console.log("Requestor Mist peers")
                requestorMist.requestCancel(signals);
                requestorMist.request('wish.identity.list', [], function (err, data) {
                    if (err) {
                        return;
                    }
                    console.log("mistapi: wish.identity.list ", data);

                });
                
                done();
                done = function() {};
            }
        });


        dstApp.request('identity.friendRequestList', [], function (err, data) {
            console.log('dstApp friendRequestList:', err, data);
            if (data.length !== 1) {
                return done(new Error('Not exactly one friendRequest in list!'));
            }

            dstApp.request('identity.friendRequestAccept', [data[0].luid, data[0].ruid], function (err, data) {
                console.log('dstApp friendRequestAccept:', err, data);
            });
        });
    });

    var srcPeer;
    var dstPeer;

    it('Get Mist peers', function (done) {
        function filterPeers(err, data) {
            if (err) {
                console.log("err", err);
                return;
            }
            for (var i in data) {
                console.log("listPeers:", i, data[i]);

                if (Buffer.compare(data[i].ruid, bobIdentity.uid) === 0) {
                    srcPeer = data[i];
                }
                if (Buffer.compare(data[i].ruid, charlieIdentity.uid) === 0) {
                    dstPeer = data[i];
                }

            }
            done()
            /*
             requestorMist.request('wish.identity.list', [], function (err, data) {
             if (err) { return; }
             console.log("mistapi: wish.identity.list ", data);
             requestorApp.request('identity.list', [], function (err, data) {
             if (err) { return; }
             console.log("wish: ", data)
             })
             done();
             })
             */

        }

        requestorMist.request('listPeers', [], filterPeers)
    })

    /* Get list of connections from Alice. Alice should have only two connections. */
    it('Get connection list from Alice', function (done) {
        this.timeout(10000);
        
        // Sleep for some time before making the request - this will allow time for the connections to be made
        setTimeout( function () { requestorApp.request('connections.list', [], function (err, data) {
            if (err) {
                return done(new Error(inspect(data)));
            }

            console.log("connections.list length is " + data.length)
            
            if (data.length === 2) {
                done()
            }
        })}, 8000)
    })
});