# Mist Developer Course

Mist 1-day developer course. 

<sub><sup>source: mist-node-api-node/doc/mist-developer-course.md</sup></sub>

## Theory

### Minimalistic intro

Wish is a framework for building distributed apps. It features high security, user management, access control and much more. It provides the developer with everything to quickly get started developing completely distributed applications

Mist is a IoT layer built on top of Wish. It provides an intuitive way of interacting with devices, and is very easy to get started with. Mist can run on everything from ESP8266 Wifi SoC with 64KiB of memory to 64 bit linux servers with hundreds of GiBs. We provide sample applications and SDK for Android (Java interface), Node.js (JavaScript), but there are not many limitations to where it can run. In it's core Mist is a C-library which can be compiled for almost any modern platform.

### Mist 

Peers in Mist are Services running on Hosts reached via Identities. 

Host: All Wish Cores are indivitual Hosts
Services: All applications are connected to Wish as Services.
Identities: All communication are between two Identities.
Peers: A service exposed to another serivce via an Identity

Via a Mist User Interface you can see peers. They are Mist Nodes attached to the peer-to-peer network, which are shared with you. There are no URL like the familar http://www.example.com, but instead everything is addressed using peers. Under the hood a peer looks something like this:

```javascript
{
  luid: <Buffer b1 be 19 ... 8f a9 31>,  // Local User Id
  ruid: <Buffer 8f 15 06 ... 47 dc 2e>,  // Remote User Id
  rhid: <Buffer 9d f3 89 ... 81 d5 7a>,  // Remote Host Id
  rsid: <Buffer 47 50 53 ... 20 6e 6f>,  // Remote Service Id
  protocol: 'ucp',                       // The protocol name
  online: true,                          // Peer online state
  l: 'John Andersson',                   // Local user alias (sometimes provided as convenience)
  r: 'Tim Rogers'                        // Remote user alias (sometimes provided as convenience)
}
```

If luid and ruid are the same the other Peer is a local peer hosted by the same Identity.


## Demonstration

Android - friends, gps
Sonoff - claiming HW device

## Hands on

Play around with the demo equipment

Get some example code and get it up and running, changing some endpoints to see that it really works. (Android and Nodejs available)

## Feedback

How does it feel?

## Closing remarks

This is a remarkably versatile library. Security by design. No 3-rd parties needed. Just get going. If you do it commercially, pay up.

## References and materials

### Developer resources

At the time of writing there is nothing here, but it will be the entry point for developers, when we get going, check it out.

https://mist.controlthings.fi/developer

Our website:

https://www.controlthings.fi

### Getting started node.js 

This is a step by step guide to Mist node development for the node.js programming environment. It is to your advantage to be familar with command line tools. Installing and using node.js is not covered in this tutorial. Please refer to the node.js homepage or your search engine of choice for getting started with node. You will need version 6.9.2, other versions might work, but are untested.

#### Wish

Download and run a `wish-core`.

```sh
mkdir wish
cd wish
wget https://mist.controlthings.fi/dist/wish-core-v0.6.8-x64-linux
chmod +x wish-core-v0.6.8-x64-linux
./wish-core-v0.6.8-x64-linux
```

#### Wish-Cli

Open a new command line.

```sh
npm install -g wish-cli
wish-cli
```

If everything went fine, you can now create an identity using the cli:

```javascript
identity.create('John Andersson')
```

It is good to know that the cli will always store the last response from the core into a variable called `result`, which is accessible in the cli.

See: https://www.npmjs.com/package/wish-cli


#### Connecting

In order to make a connection you will need two cores with an identity set up on each. These systems will need to be in the same local area network for this approach to work, as we will use local discovery to become friends.

##### Friend requesting side

```javascript
identity.list()
var myUid = result[0].uid
wld.list()             // wld stands for WishLocalDiscovery
                       // Find the index of the result that corresponds to 
                       // the other host you would like to connect to
var friend = result[n] // Replace n with the index
wld.friendRequest(myUid, friend.ruid, friend.rhid)
```

##### Friend requestee side

```javascript
identity.list()
var myUid = result[0].uid
identity.friendRequestList()
identity.friendRequestAccept(result[0].luid, result[0].ruid)
```

When you are successful you can run:

```javascript
identity.list()
```

and you will get the result:

```javascript
[ { uid: <Buffer b1 be 19 ... 26 8f a9 31>,
    alias: 'John Andersson',
    privkey: true },
  { uid: <Buffer 50 f7 54 ... 46 44 5b>,
    alias: 'Tim Rogers',
    privkey: false } ]
```

The privkey field shows wether you have access to the private key or not for each identity. Only your identities have the private key, while your contacts show `privkey: false`.

#### Mist App

Finally we have come to the part where you can start writing an application. You can start writing your application from scratch, or by starting for some of our application templates from GitHub: https://github.com/akaustel/mist-examples-nodejs

#### Mist Cli

Mist Cli is really useful for accessing things in Mist. You can list Mist devices you have access to, and you can send Mist commands, like read write and invoke, as well as use management commands. It should tell you all you need to know as soon as you get it running.

See: https://www.npmjs.com/package/mist-cli

```javascript
npm install -g mist-cli
./mist-cli
```

An example is to access the example application you from the previous step. 

Find the peers you can talk to using the list() command:

```javascript
mist> list()
Known peers:
  peers[0]: GPS node.js (John Anderssson) 
```

##### Model

In this example we are using the `mist-gps-node` example. 

```javascript
mist.control.model(peers[0])
```

Which should give you something like this:

```javascript
{ device: 'GPS node.js',
  model: 
   { mist: { name: 'GPS node.js' },
     lon: { label: 'Longitude', type: 'float', read: true },
     lat: { label: 'Latitude', type: 'float', read: true },
     accuracy: { label: 'Accuracy', type: 'float', read: true },
     counter: { label: 'Dummy Counter', type: 'int', read: true, write: true },
     config: { label: 'Configuration', type: 'invoke', invoke: true },
     enabled: { label: 'GPS enabled', type: 'bool', read: true, write: true } } }
```

The endpoints available are listed in the model. Endpoints are identified by their keys, called also called endpoint id or epid for short. Examples of epid's in the above model are lon, lat and enabled.

##### Read

You can now read the longitude from the GPS by issuing a mist read command:

```javascript
mist.control.read(peers[0], 'lon')
21.92429658
mist.control.read(peers[0], 'lat')
41.02307204
```

##### Write

```javascript
mist.control.write(peers[0], 'enabled', true)
```

##### Follow

If you want to stay in sync with the GPS device, you can use that by issuing a mist follow command:

```javascript
mist.control.follow(peers[0])
```

In future versions follow will also support filtering the tree structured model like:

```javascript
mist.control.follow(peers[0], 'sensors.temperatures')
```

Which would only send updates on changes to the values under sensors.temperatures in the model structure.

##### Invoke

The invoke command has arguments and returns a value, just like a method/function call.

```javascript
var args = { this: 'can', be: ['whatever', 'you', 'like', true, 42], even: new Buffer("Nice") };
mist.control.invoke(peers[0], 'config', args)
```

```javascript
{ an: 'object-response',
  to: 'an object',
  echo: 
   { this: 'can',
     be: [ 'whatever', 'you', 'like', true, 42 ],
     even: <Buffer 4e 69 63 65> } }
```

#### Programmatical access

```javascript
var MistNode = require('mist-api').MistNode;

var node = new MistNode('RandomBeacon');

node.on('online', (peer) => {
  node.request(peer, 'control.invoke', ['cool', 7, true, new Buffer('0001EFCDBA', 'hex')], () => {
    
  })
});

```



