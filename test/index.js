var MistApi = require('../');
var assert = require('assert');
var BSON = require('wish-bson').BSONPure.BSON;


describe('native extension', function () {
    it('should export a wrapped object', function () {
        var obj = new MistApi.MyObject(0);
        assert.equal(obj.plusOne(), 1);
        assert.equal(obj.plusOne(), 2);
        assert.equal(obj.plusOne(), 3);
    });

    it('should export a wrapped object for a second instance', function () {
        var obj = new MistApi.MyObject(0);
        assert.equal(obj.plusOne(), 1);
        assert.equal(obj.plusOne(), 2);
        assert.equal(obj.plusOne(), 3);
    });

    it('should export function that returns nothing', function () {
        assert.equal(MistApi.nothing(), undefined);
    });

    it('should export a function that returns a string', function () {
        assert.equal(typeof MistApi.aString(), 'string');
    });

    it('should export a function that returns a boolean', function () {
        assert.equal(typeof MistApi.aBoolean(), 'boolean');
    });

    it('should export function that returns a number', function () {
        assert.equal(typeof MistApi.aNumber(), 'number');
    });

    it('should export function that returns an object', function () {
        assert.equal(typeof MistApi.anObject(), 'object');
    });

    it('should export function that returns an object with a key, value pair', function () {
        assert.deepEqual(MistApi.anObject(), {'key': 'value'});
    });

    it('should export function that returns an array', function () {
        assert.equal(Array.isArray(MistApi.anArray()), true);
    });

    it('should export function that returns an array with some values', function () {
        assert.deepEqual(MistApi.anArray(), [1, 2, 3]);
    });

    it('should export function that calls a callback', function (done) {
        MistApi.callback(done);
    });

    it('should happen before blocking', function (done) {
        //const emitStream = require('emit-stream');
        //const through = require('through');
        this.timeout(6000);
        
        var EventEmitter = require('events');
        var emitter = new EventEmitter();
        
        var worker = new MistApi.StreamingWorker(
                function (event, value) {
                    emitter.emit(event, value);
                },
                function () {
                    emitter.emit("close");
                },
                function (error) {
                    emitter.emit("error", error);
                },
                null);

        var sw = {};
        sw.from = emitter;
        /*sw.from.stream = function () {
            return emitStream(sw.from).pipe(
                    through(function (data) {
                        if (data[0] === "close") {
                            this.end();
                        } else {
                            this.queue(data);
                        }
                    }));
        };*/
        
        worker.sendToAddon("go", 1, BSON.serialize({ way: 'cool', works: true }));

        setTimeout(function () {
            worker.sendToAddon("go", 7);
        }, 1000);

        setTimeout(function () {
            worker.sendToAddon("go", 20);
            worker.sendToAddon("go", -1);
        }, 2000);

        emitter.on('even', function(data) { console.log("even", data); if(data === '20') { done(); } });
        emitter.on('odd', function(data) { console.log("odd", data); });
    });

    //it('should create a mist_app instance', function () {
    //    assert.equal(typeof MistApi.mistApp(), 'boolean');
    //});

    /*
     it('should set callback function and be called', function(done) {
     var obj = new nativeExtension.MyObject(7);
     obj.setCallback(function() {
     //assert.equal(typeof nativeExtension.mistApp(), 'boolean');
     console.log("This was called.");
     done();
     });
     });
     */
});
