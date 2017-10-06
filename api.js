
var Plugin = {
    emits: ['online', 'offline', 'frame', 'write', 'invoke', 'wish', 'mist', 'mistnode', 'sandboxed', 'done'],
    request: fn(['kill', 'wish', 'mist', 'mistnode', 'sandboxed'], BSON(args))
};

var WishApp = {
    type: 4,
    emits: ['ready', 'online', 'offline', 'frame', 'wish'],
    request: fn(op, args, cb), // 'wish', BSON({ op, args, id })
    requestBare: fn(op, args, cbBare),
    requestCancel: fn(id),
    cancel: fn(id),
    send: fn(peer, payload),
    broadcast: fn(payload),
    disconnect: fn(),
    shutdown: fn()
};

var Mist = {
    type: 2,
    emits: ['ready'],
    node: MistNode,
    wish: WishApp,
    sandboxes: [Sandboxed-1, Sandboxed-2, '...'],
    request: fn(op, args, cb),
    requestBare: fn(op, args, cbBare),
    requestCancel: fn(id),
    registerSandbox: fn(Sandboxed),
    shutdown: fn()
};

var MistNode = {
    type: 3,
    emits: ['ready', 'online', 'offline', 'read', 'write', 'invoke'],
    wish: WishApp,
    request: fn(peer, op, args, cb),
    requestBare: fn(peer, op, args, cbBare),
    requestCancel: fn(id),
    create: fn(model),
    read: fn(args, peer, cb),
    write: fn(args, peer, cb),
    invoke: fn(args, peer, cb),
    changed: fn(epid),
    shutdown: fn()
};

var Sandboxed = {
    sandboxId: sid,
    request: fn(peer, op, args, cb), // { mist.request('sandboxed.'+ op ...) },
    requestBare: fn(peer, op, args, cbBare),
    requestCancel: fn(id)
};

