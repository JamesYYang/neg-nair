const net = require('net');
const protocol = require('./nairProtocol');
const ReqGetPackage = protocol.ReqGetPackage;
const ReqGetMetaPackage = protocol.ReqGetMetaPackage;
const ReqSetPackage = protocol.ReqSetPackage;
const ReqDelPackage = protocol.ReqDelPackage;
const ReqIncrPackage = protocol.ReqIncrPackage;
const ResultParser = require('./resultParse');
const negUtil = require('neg-util');
const logger = require('./logger');

function NairClient(host, port, options) {
  this.host = host;
  this.port = port;
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
  this.max_attempts = null; //不设置最大重试次数
  this.max_delay = 30 * 1000; //最大delay位30s
  this.request_timeout = options.request_timeout || 100; //默认100ms
  this.request_timer = null;
  this.install_stream_listeners();
};

function WaitObj(objId, args, callback) {
  this.objId = objId;
  this.args = args;
  this.callback = callback;
  this.requestAt = new Date().valueOf();
}

NairClient.prototype.install_stream_listeners = function () {
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
    logger.log(`Stream connected: + ${this.address}`);
  }

  this.connected = true;
  this.stream.setNoDelay();
  this.stream.setTimeout(0);
  this.waitQueue = [];
  this.retry_timer = null;
  this.retry_delay = 150;
  this.retry_backoff = 1.7;
  this.attempts = 1;
  this.max_attempts = null; //不设置最大重试次数
  this.max_delay = 30 * 1000; //最大delay位30s
  this.parser = new ResultParser({
    debug_mode: this.debug_mode
  });
  var self = this;
  this.parser.on('reply', function (reply) {
    self.return_reply(reply);
  });

  this.request_timer = setInterval(() => {
    let current = new Date().valueOf();
    while (this.waitQueue.length > 0) {
      if (this.waitQueue[0].requestAt + this.request_timeout <= current) {
        let obj = this.waitQueue.shift();

        logger.warn(`package (${obj.objId}) - timeout: ${obj.requestAt}, current: ${current}`);

        if (typeof obj.callback === "function") {
          try {
            obj.callback('request timeout');
          } catch (err) {}
        }
      } else {
        break;
      }
    }
  }, this.request_timeout);
};

NairClient.prototype.on_error = function (msg) {
  var message = `Nair connection to ${this.address} failed. Error: ${msg}`;

  if (this.debug_mode) {
    logger.warn(message);
  }

  this.flush_and_error(message);
  this.connection_gone("error");
};

NairClient.prototype.flush_and_error = function (message) {
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

  if (this.request_timer) {
    this.request_timer = null;
  }

  if (this.debug_mode) {
    logger.warn(`Nair connection is gone from ${why} event.`);
  }

  if (why !== "error") {
    this.flush_and_error(`Nair connection is gone from ${why} event.`);
  }

  this.retry_delay = Math.floor(this.retry_delay * this.retry_backoff);
  if (this.retry_delay > this.max_delay) {
    this.retry_delay = this.max_delay;
  }

  if (this.debug_mode) {
    logger.log(`Retry connection in ${this.retry_delay} ms`);
  }

  if (this.max_attempts && this.attempts >= this.max_attempts) {
    this.retry_timer = null;
    logger.error(`Couldn't get Nair connection after ${this.max_attempts} attempts.`);
    return;
  }

  this.attempts += 1;

  this.retry_timer = setTimeout(function () {
    if (self.debug_mode) {
      logger.log(`Retrying connection for ${self.attempts} times...`);
    }

    self.stream = net.createConnection(self.port, self.host);
    self.install_stream_listeners();
    self.retry_timer = null;
  }, this.retry_delay);
};

NairClient.prototype.on_data = function (data) {
  if (this.debug_mode) {
    logger.log(`===============================================net read ${this.address}, data length: ${data.length}`);
  }
  this.parser.execute(data);
};

NairClient.prototype.return_reply = function (result) {
  if (this.waitQueue.length > 0) {
    if (this.waitQueue[0].objId !== result.packetId) {
      return;
    } else {
      let obj = this.waitQueue.shift();
      obj.callback(null, result);
    }
  }
};

NairClient.prototype.get = function (area, key, callback) {
  var getData = new ReqGetPackage(area, key);
  var args = {
    area: area,
    key: key
  };
  this.waitQueue.push(new WaitObj(getData.header.packetId, args, callback));
  this.stream.write(getData.toBuffer());

  if (this.debug_mode) {
    logger.log(`send command get for packageId: ${getData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

NairClient.prototype.getMeta = function (area, key, callback) {
  var getData = new ReqGetMetaPackage(area, key);
  var args = {
    area: area,
    key: key
  };
  this.waitQueue.push(new WaitObj(getData.header.packetId, args, callback));
  this.stream.write(getData.toBuffer());

  if (this.debug_mode) {
    logger.log(`send command getMeta for packageId: ${getData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

NairClient.prototype.set = function (area, key, value, expired, callback) {
  var args = {
    area: area,
    key: key,
    value: value,
    expired: expired
  };
  if (!negUtil.is("String", value)) {
    value = JSON.stringify(value);
  }
  var setData = new ReqSetPackage(area, key, value, expired);
  this.waitQueue.push(new WaitObj(setData.header.packetId, args, callback));
  this.stream.write(setData.toBuffer());

  if (this.debug_mode) {
    logger.log(`send command set for packageId: ${setData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

NairClient.prototype.incr = function (area, key, value, defaultValue, expired, callback) {
  var args = {
    area: area,
    key: key,
    value: value,
    defaultValue: defaultValue,
    expired: expired
  };

  var incrData = new ReqIncrPackage(area, key, value, defaultValue, expired);
  this.waitQueue.push(new WaitObj(incrData.header.packetId, args, callback));
  this.stream.write(incrData.toBuffer());

  if (this.debug_mode) {
    logger.log(`send command incr for packageId: ${incrData.header.packetId} and area: ${area} and key: ${key}`)
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

  if (this.debug_mode) {
    logger.log(`send command del for packageId: ${delData.header.packetId} and area: ${area} and key: ${key}`)
  }
};

module.exports = NairClient;