'use strict';

var request = require('request');
var negUtil = require('neg-util');
var pool = require('./lib/connectionPool');
var nairDBInfo;
var nairDBHash;
var debug_mode;
var location;
const DEFAULTEXPIRED = 60 * 60 * 24;

exports.init = (options, callback) => {
  options = options || {};
  if(!options.hosts){
    throw new Error('Please provider nair host!');
  }
  if(!options.nairDBUri){
    throw new Error('Please provider uri for get nair db info!');
  }
  debug_mode = options.debug_mode;
  location = options.location || "WH7";

  pool.init(options.hosts, options);

  setInterval(getNairDBInfoInterval, 5 * 60 * 1000, options.nairDBUri);

  getNairDBInfo(options.nairDBUri, (err, db) => {
    if(err){
      callback(err);
    }else{
      nairDBHash = negUtil.getHash(db);
      nairDBInfo = JSON.parse(db);
      if(debug_mode){
        console.log(`get nairl db: ${nairDBInfo.length}`);
      }
      callback(null);
    }
  });
};

var getNairDBInfo = (uri, callback) => {
  var reqOption = {
    url: uri,
    headers: {
      "accept": "application/json"
    }
  };

  request(reqOption, (err, res, body) => {
    if (err && res.statusCode >= 400){
      callback(new Error('Get nair db info failed.'), null);
    }else{
      callback(null, body);
    }

  })
};

var getNairDBInfoInterval = (uri) => {
  var reqOption = {
    url: uri,
    headers: {
      "accept": "application/json"
    }
  };

  request(reqOption, (err, res, body) => {
    if(!err && res.statusCode === 200){
      if(debug_mode) {
       console.log(`refresh nair db info`);
      }
      var newHash = negUtil.getHash(body);
      if(newHash !== nairDBHash){
        try{
          nairDBInfo = JSON.parse(body);
          nairDBHash = newHash;
        }catch(err){}
      }
    }

  })
};

var insuranceDatabase = (dbName, password) => {
  var db = findDB(dbName);
  if(!db){
    throw new Error(`Invalid nair db: ${dbName}`);
  }else{
    if(db.Password && db.Password !== password){
      throw new Error("Invalid password.");
    }
    if(db.DatabaseLocation.toUpperCase() !== location){
      throw new Error("Invalid database location.");
    }
  }

  return db;
};

var findDB = (dbName) => {
  if(!nairDBInfo || nairDBInfo.length === 0){
    throw new Error("Please init nair db info first");
  }

  for(let db of nairDBInfo){
    if(db.DatabaseName === dbName){
      return db;
    }
  }
};

var makeNairKey = (dbId, key) => {
  return `${dbId}_${key}`;
};


exports.get = (dbName, key, password) => {
  return new Promise((resolve, reject) => {
    try{
      var db = insuranceDatabase(dbName, password);
      var client = pool.getConnection();
      client.get(db.TairDbId, makeNairKey(db.DatabaseId, key), (err, result) => {
        if(err){
          reject(err);
        }else if(!result.success){
          resolve(null);
        }else{
          resolve(result.value);
        }
      });

    }catch(error){
      reject(error);
    }
  });
};

exports.set = (dbName, key, value, password, expired) => {
  return new Promise((resolve, reject) => {
    try{
      var db = insuranceDatabase(dbName, password);
      expired = expired || DEFAULTEXPIRED;
      var client = pool.getConnection();
      client.set(db.TairDbId, makeNairKey(db.DatabaseId, key), value, expired, (err, result) => {
        if(err){
          reject(err);
        }else if(!result.success){
          reject(new Error('Set value failed.'));
        }else{
          resolve(null);
        }
      });

    }catch(error){
      reject(error);
    }
  });
};

exports.del = (dbName, key, password) => {
  return new Promise((resolve, reject) => {
    try{
      var db = insuranceDatabase(dbName, password);
      var client = pool.getConnection();
      client.del(db.TairDbId, makeNairKey(db.DatabaseId, key), (err, result) => {
        if(err){
          reject(err);
        }else if(!result.success){
          reject(new Error('Delete value failed.'));
        }else{
          resolve(null);
        }
      });

    }catch(error){
      reject(error);
    }
  });
};
