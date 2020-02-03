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
//var WishApp = require('mist-api').WishApp;
var WishApp = require('../index.js').WishApp;
var Client = require('wish-rpc').Client;
var Server = require('wish-rpc').Server;
var inspect = require("util").inspect;
var repl = require('repl');
var path = require('path');
var fs = require('fs');
var bson = require('bson-buffer');
var BSON = new bson();

var white = '\u001b[37m';
var yellow = '\u001b[33m';
var green = '\u001b[34m';
var blue = '\u001b[32m';
var reset = '\u001b[39m';

function File() {
    var self = this;
    this.app = new WishApp({ name: process.env.SID || 'File', protocols: ['file'] });
    this.peers = [];

    var server = new Server({
        _send: {},
        send: function(req, res) {
            console.log('receiving file:', req.args[0], 'size', req.args[1]);
            
            var os = fs.createWriteStream('./'+req.args[0]);
            
            this.data = function(data) {
                //console.log('about to write', data);
                os.write(data);
                //console.log('receiving data for ', req.args[0], data.length);
                process.stdout.write('.');
                res.emit(data.length);
            };
            
            this.end = function() {
                console.log('last chunk of ', req.args[0], 'received');
                os.close();
            };
            
            res.emit('ok');
        }
    });
    
    self.app.onlineCb = function(peer) {
        peer.rpc = new Client(function(data) { self.app.send(peer, BSON.serialize(data)); });

        self.peers.push(peer);
        self.app.request('identity.get', [peer.ruid], function(err, user) {
            console.log(reset+'online:'+blue, user.alias);
        });
    };

    self.app.offlineCb = function(peer) {
        self.app.request('identity.get', [peer.ruid], function(err, user) {
            console.log(reset+'offline:'+blue, user.alias);
        });
    };

    self.app.frameCb = function(peer, data) {
        var msg = BSON.deserialize(data);
        
        if (msg.op || msg.push || msg.end) {
            server.parse(msg, function(data) { self.app.send(peer, BSON.serialize(data)); }, {});
        } else {
            for(var i in self.peers) {
                if ( Buffer.compare(peer.luid, self.peers[i].luid) === 0
                      && Buffer.compare(peer.ruid, self.peers[i].ruid) === 0
                      && Buffer.compare(peer.rhid, self.peers[i].rhid) === 0
                      && Buffer.compare(peer.rsid, self.peers[i].rsid) === 0 )
                {
                    self.peers[i].rpc.messageReceived(msg);
                    return;
                }
            }
        }
    };

    this.repl = repl.start({
        prompt: "file> ",
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        ignoreUndefined: true,
        writer : function (obj) {
            return inspect(obj, 10, null, true);
        }
    });
    
    this.repl.resetContext();
    
    this.repl.context.peers = this.peers;
    this.repl.context.send = function(file) {
        var rs = fs.createReadStream(file);
        
        var id = self.peers[0].rpc.request('send', ['my-'+path.basename(file), fs.statSync(file).size], function(err, data) {
            
            if(data ==='ok') {
                rs.once('readable', function() {
                    self.peers[0].rpc.send(id, rs.read(16*1024));
                });
                
                rs.on('end', function() {
                    console.log('this is the end of the file...');
                    self.peers[0].rpc.end(id); 
                });
            } else {
                var chunk = rs.read(16*1024);
                
                if (chunk === null) {
                    rs.once('readable', function() {
                        self.peers[0].rpc.send(id, rs.read(16*1024));
                    });
                } else {
                    self.peers[0].rpc.send(id, chunk);
                }
            }
        });
    };

    this.repl.on("exit", function () {
        self.app.disconnect();
        console.log("Bye!");
        process.exit(0);
    });    
}

var file = new File();