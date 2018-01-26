# Commission

## Commissioning from within a HTML5 UI

`api.signals()`
`api.settings(commission.refresh)`

MistApi receives `signals`:

```js
[ 'sandboxed.settings',
  { id: <Buffer de ad be ef ... 00 00 00>,
    hint: 'commission.refresh' } ]
```

Mist should refresh wifi networks and/or other commissionable sources and emit them to the sandbox:


```js
sandbox.emit(sandboxId, 'commission.list')
```

indicating that the commission list has been updated.

```js
commission.list(classFilter?: String)
```

```js
[{
  type: "wifi"
  ssid: String,
  level: int32
},
{ 
  type: "local"
  alias: "André (CT)",
  class: "com.company.devicetype",
  pubkey: <Buffer ab cd ...>,
  rhid: <Buffer ab cd ...>,
  ruid: <Buffer ab cd ...>
  claim?: bool
}]
```

```js
settings('commission', CommissionListItem)
```

MistApi sees:

```js
[ 'sandboxed.settings',
  { id: <Buffer de ad ... 00>,
    hint: 'commission',
    opts: 
     { type: 'local',
       alias: 'jan',
       ruid: <Buffer 65 06 ... 67 9e>,
       rhid: <Buffer da 3c ... fd 9e>,
       pubkey: <Buffer 28 85 ... bc 1a> } } ]
```

If `1.opts.type` is `wifi` then join the wifi `1.opts.ssid`, and wait for local discovery to find a host. Send friendRequest to that host and wait for Mist peer where "mist.name" is `MistConfig`  to come online. 

`mist.control.invoke(peers[13], 'mistWifiListAvailable')`

returns something like this (was supposed to be an Array but is actually an Object with array indexes, this might be changed in the future):

```javascript
{ '0': { ssid: 'Guest Network', rssi: -54 },
  '1': { ssid: 'dlink', rssi: -83 },
  '2': { ssid: 'Internet', rssi: -51 },
  '3': { ssid: 'Buffalo-G-12DA', rssi: -31 },
  '4': { ssid: 'Teltonika_Router', rssi: -14 },
  '5': { ssid: 'TW-WLAN-BR', rssi: -67 } }
```


`mist.control.invoke(peers[13], 'mistWifiCommissioning', { ssid: 'Buffalo-G-12DA', wifi_Credentials: '19025995' })`


Do the actual commissioning, and when done, add peers to the originating sandbox and emit commission.finished with the list of peers resulting from the commissioning.

```js
sandbox.addPeer(sandbox, peer[n])
sandbox.emit('commission.finished', [peers]);
```



