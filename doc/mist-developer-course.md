# Mist Developer Course

Mist 10h developer course is based on the concept developed 

## Theory

## Demonstration

## Hands on

## Feedback

## Closing remarks

## References and materials

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

If everything went file, you can now create an identity using the cli:

```javascript
identity.create('John Andersson')
```

It is good to know that the cli will always store the last response from the core into a variable called `result`, which is accessible in the cli.


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

There is a known bug which timeouts the friendRequest in about 10 seconds, which requres you to prepare the requestee side to have everything done but the two last lines; List and Accept commands ready.

When you are successful you can run:

```javascript
identity.list()
```

and you will get the result:

```javascript
wish> [ { uid: <Buffer b1 be 19 ... 26 8f a9 31>,
    alias: 'John Andersson',
    privkey: true },
  { uid: <Buffer 50 f7 54 ... 46 44 5b>,
    alias: 'Tim Rogers',
    privkey: false } ]
```

The privkey field shows wether you have access to the private key or not for each identity. Only you identities have the private key, while your contacts show privkey false.











