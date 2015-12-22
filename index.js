'use strict';

var request = require('request');
var negUtil = require('neg-util');
var pool = require('./lib/connectionPool');
var logger = require('./lib/logger');
var nairDBInfo;
var nairDBHash;
var debug_mode;
var location;
var needMatchDB;
const DEFAULTEXPIRED = 60 * 60 * 24;
const BELOWZERO = 4294967295;

exports.init = (options, callback) => {
  options = options || {};
  if(!options.hosts){
    throw new Error('Please provider nair host!');
  }

  debug_mode = options.debug_mode;
  location = options.location || "WH7";
  needMatchDB = options.nairDBUri ? true : false;

  if(options.log){
    logger.setLogger(options.log);
  }

  pool.init(options.hosts, options);

  if(needMatchDB){
    setInterval(getNairDBInfoInterval, 5 * 60 * 1000, options.nairDBUri);

    getNairDBInfo(options.nairDBUri, (err, db) => {
      if(err){
        callback(err);
      }else{
        nairDBHash = negUtil.getHash(db);
        nairDBInfo = buildNairDBInfo(JSON.parse(db));
        if(debug_mode){
          logger.log(`get nairl db: ${nairDBInfo.size}`);
        }
        callback(null);
      }
    });
  }else{
    if(debug_mode){
      logger.log('access nair with direct mode');
    }
    callback(null);
  }

};

var getNairDBInfo = (uri, callback) => {
  var reqOption = {
    url: uri,
    headers: {
      "accept": "application/json"
    }
  };

  request(reqOption, (err, res, body) => {
    if (err || res.statusCode >= 400){
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
      var newHash = negUtil.getHash(body);
      if(newHash !== nairDBHash){
        try{
          nairDBInfo = buildNairDBInfo(JSON.parse(body));
          nairDBHash = newHash;

          if(debug_mode){
            logger.log(`refresh nairl db: ${nairDBInfo.size}`);
          }
        }catch(err){}
      }
    }

  })
};

var buildNairDBInfo = (dbs) => {
  if(!dbs && dbs.length === 0){
    return;
  }
  var newMap = new Map();
  for(let db of dbs){
    newMap.set(db.DatabaseName, db);
  }
  return newMap;

};

var insuranceDatabase = (dbName, password) => {
  if(!needMatchDB){
    if(negUtil.is("Number", dbName) && dbName >= 0){
      return {
        TairDbId: dbName
      };
    }else{
      throw new Error("Invalid database Id.");
    }
  }else{
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
  }
};

var findDB = (dbName) => {
  if(!nairDBInfo || nairDBInfo.size === 0){
    throw new Error("Please init nair db info first");
  }
  return nairDBInfo.get(dbName);
};

var makeNairKey = (dbId, key) => {
  return needMatchDB ? `${dbId}_${key}` : key;
};

var insuranceExpired = (expired) => {
  expired = expired != null ? expired : DEFAULTEXPIRED;
  expired = expired < 0 ? BELOWZERO : expired;
  return expired;
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
      expired = insuranceExpired(expired);
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

exports.incr = (dbName, key, value, defaultValue, password, expired) => {
  return new Promise((resolve, reject) => {
    try{
      var db = insuranceDatabase(dbName, password);
      expired = insuranceExpired(expired);
      var client = pool.getConnection();
      client.incr(db.TairDbId, makeNairKey(db.DatabaseId, key), value, defaultValue, expired, (err, result) => {
        if(err){
          reject(err);
        }else if(!result.success){
          reject(new Error('Increase value failed.'));
        }else{
          resolve(result.value);
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

