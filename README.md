neg-nair
===================

Nair is a distributed memory database in Newegg.

This is the nodejs SDK for nair.

## Install

```sh
$ npm install neg-nair
```

## How to Use

```js
'use strict';

var nair = require('neg-nair');
var hosts = ['10.16.75.25:8887','10.16.75.26:8887','10.16.75.27:8887'];
var uri = 'http://127.0.0.1:9091/nairdata';


var options = {
  hosts: hosts,
  nairDBUri: uri,
  debug_mode: true
};


nair.init(options, (err) => { //need a few seconds to init connection
  if(err){
    console.log(err);
  }else{
    console.log('init success');
  }

  nair.get('testdb', 'testkey', 'pwd') // dbName, key, pwd
  .then((value) => {console.log(value)})
  .catch((err) => {console.log(err)});

  nair.set('testdb', 'testkey', options, 'pwd', 60) //dbName, key, value, pwd, expired
    .then((value) => {console.log(value)})
    .catch((err) => {console.log(err)});

  nair.del('testdb', 'testkey', 'pwd') // dbName, key, pwd
    .then((value) => {console.log(value)})
    .catch((err) => {console.log(err)});
});
```

## License

MIT

