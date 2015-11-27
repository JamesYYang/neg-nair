'use strict';

var net = require('net');
var protocol = require('./nairProtocol');
var ReqGetPackage = protocol.ReqGetPackage;
var ReqSetPackage = protocol.ReqSetPackage;
var ReqDelPackage = protocol.ReqDelPackage;
var ResultParser = require('./resultParse');
var negUtil = require('neg-util');

function NairClient(host, port, options){
  this.address = `${host}:${port}`;
  this.stream = net.createConnection(port, host);
  this.options = options || {};
  this.debug_mode = options.debug_mode;
  this.connected = false;
  this.waitQueue = [];
  this.retry_timer = null;
  this.retry_delay = 150;
  this.retry_backoff = 1.7;
  this.attempts = 1;
  this.max_attempts = 10;
  this.install_stream_listeners();
};

function WaitObj(objId, args, callback) {
  this.objId = objId;
  this.args = args;
  this.callback = callback;
}

NairClient.prototype.install_stream_listeners = function() {
  var self = this;

  this.stream.on("connect", function () {
    self.on_connect();
  });

  this.stream.on("data", function (buffer_from_socket) {
    self.on_data(buffer_from_socket);
  });

  this.stream.on("error", function (msg) {
    self.on_error(msg.message);
  });

  this.stream.on("close", function () {
    self.connection_gone("close");
  });

  this.stream.on("end", function () {
    self.connection_gone("end");
  });

};

NairClient.prototype.on_connect = function () {
  if (this.debug_mode) {
    console.log(`Stream connected: + ${this.address}`);
  }

  this.connected = true;
  this.stream.setNoDelay();
  this.stream.setTimeout(0);
  this.waitQueue = [];
  this.retry_timer = null;
  this.retry_delay = 150;
  this.retry_backoff = 1.7;
  this.attempts = 1;
  this.max_attempts = 10;
  this.parser = new ResultParser({debug_mode: this.debug_mode});
  var self = this;
  this.parser.on('reply', function(reply){
    self.return_reply(reply);
  });
};

NairClient.prototype.on_error = function (msg) {
  var message = `Nair connection to ${this.address} failed. Error: ${msg}`;

  if (this.debug_mode) {
    console.warn(message);
  }

  this.flush_and_error(message);
  this.connection_gone("error");
};

NairClient.prototype.flush_and_error = function(message){
  var error = new Error(message);
  while (this.waitQueue.length > 0) {
    var obj = this.waitQueue.shift();
    if (typeof obj.callback === "function") {
      try {
        obj.callback(error);
      } catch (callback_err) {
        process.nextTick(function () {
          throw callback_err;
        });
      }
    }
  }
  this.waitQueue = [];
  this.connected = false;
};

NairClient.prototype.connection_gone = function (why) {
  var self = this;

  if (this.retry_timer) {
    return;
  }

  if (this.debug_mode) {
    console.warn(`Nair connection is gone from ${why} event.`);
  }

  if(why !== "error") {
    this.flush_and_error(`Nair connection is gone from ${why} event.`);
  }

  this.retry_delay = Math.floor(this.retry_delay * this.retry_backoff);

  if (this.debug_mode) {
    console.log(`Retry connection in ${this.retry_delay} ms`);
  }

  if (this.max_attempts && this.attempts >= this.max_attempts) {
    this.retry_timer = null;
    console.error(`Couldn't get Nair connection after ${this.max_attempts} attempts.`);
    return;
  }

  this.attempts += 1;

  this.retry_timer = setTimeout(function () {
    if (self.debug_mode) {
      console.log("Retrying connection...");
    }

    self.stream = net.createConnection(self.connectionOption);
    self.install_stream_listeners();
    self.retry_timer = null;
  }, this.retry_delay);
};

NairClient.prototype.on_data = function (data) {
  if (this.debug_mode) {
    console.log(`===============================================net read ${this.address}, data length: ${data.length}`);
  }
  this.parser.execute(data);
};

NairClient.prototype.return_reply = function(result){
  var obj = this.waitQueue.shift();
  obj.callback(null, result);

};

NairClient.prototype.get = function (area, key, callback) {
  var getData = new ReqGetPackage(area, key);
  var args = {
    area: area,
    key: key
  };
  this.waitQueue.push(new WaitObj(getData.header.packetId, args, callback));
  this.stream.write(getData.toBuffer());

  if(this.debug_mode){
    console.log(`send command get for packageId: ${getData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

NairClient.prototype.set = function (area, key, value, expired, callback) {
  var args = {
    area: area,
    key: key,
    value: value,
    expired: expired
  };
  if(!negUtil.is("String", value)){
    value = JSON.stringify(value);
  }
  var setData = new ReqSetPackage(area, key, value, expired);
  this.waitQueue.push(new WaitObj(setData.header.packetId, args, callback));
  this.stream.write(setData.toBuffer());

  if(this.debug_mode){
    console.log(`send command set for packageId: ${setData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

NairClient.prototype.del = function (area, key, callback) {
  var delData = new ReqDelPackage(area, key);
  var args = {
    area: area,
    key: key
  };
  this.waitQueue.push(new WaitObj(delData.header.packetId, args, callback));
  this.stream.write(delData.toBuffer());

  if(this.debug_mode){
    console.log(`send command del for packageId: ${delData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

module.exports = NairClient;