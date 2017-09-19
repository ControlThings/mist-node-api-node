var WishApp = require('../../index.js').WishApp;
var inspect = require('util').inspect;

describe('Wish Services', function () {
    var app;
    var opts = { name: 'Babbel', protocols: ['chat'], corePort: 9095 };

    before(function (done) {
        app = new WishApp(opts);

        app.on('ready', function() {
            done();
        });
    });

    it('services.list should find service', function(done) {
        app.request('services.list', [], (err, data) => {
            if (err) { return done(new Error(inspect(data))); }
            
            for (var i in data) {
                var o = data[i];
                
                if (o.name === opts.name && o.protocols[0] === opts.protocols[0]) {
                    return done();
                }
            }
            
            done(new Error('Service not found looking for self:'+ inspect(opts) +' in: '+ inspect(data)));
        });
    });
});
