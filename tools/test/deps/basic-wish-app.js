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
/**
 * This basic Wish app is used for the test 'wish-app-multiple-in-separate-processes.js' for testing the situation where a 
 * large number of Wish services in separate node processes are started simultaneously against one core.
 */

var Mist = require('../../../index.js').Mist;
var MistNode = require('../../../index.js').MistNode;
var WishApp = require('../../../index.js').WishApp;

var instanceName = process.env.TEST_INSTANCE_NAME;
if (!instanceName) {
    console.log("INSTANCE_NAME env variable not defined, exiting.");
    process.exit(1);
}

var corePort;
if (process.env.TEST_CORE_PORT) {
    corePort = parseInt(process.env.TEST_CORE_PORT);
}

console.log('creating instance: ', instanceName);
//var mist = new MistNode({ name: 'MistNode-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
//var mist = new Mist({ name: 'MistApp-'+i, protocols: [], coreIp: '127.0.0.1', corePort: 9095 });
var wish = new WishApp({ name: instanceName, protocols: [], coreIp: '127.0.0.1', corePort: corePort });
wish.on('ready', () => {
    console.log("instance ready", instanceName);
});