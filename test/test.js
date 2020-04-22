const nair = require('../index');
const crypto = require("crypto");
var hosts = ['10.16.75.22:8887','10.16.75.24:8887','10.16.75.26:8887'];
let db = 9;

var options = {
  hosts: hosts,
  debug_mode: false
};

let getRandomString = (size) => crypto.randomBytes(size).toString('hex');

let doTest = async (parellism, turn) => {
  console.log('begin test')
  let a = [];
  for (let i = 0; i < parellism; i++) {
    a.push(i)
  }
  let t = 0;
  while (t < turn) {
    console.time(t)
    await Promise.all(a.map(() => putData())).catch((errs) => console.error(errs));
    console.timeEnd(t)
    t++;
  }
  console.log('finish test')
}

let putData = async() => {
  let key = getRandomString(8);
  await nair.set(db, key, `${key}_test`, null, 600);
  let value = await nair.get(db, key);
  console.log(`put data key: ${key}, value: ${key}_test.  then get value: ${value}`);
}

nair.init(options, (err) => { //need a few seconds to init connection
  if(err){
    console.log(err);
  }else{
    console.log('init success');
  }
  setTimeout(() => doTest(3, 10), 5000);
});