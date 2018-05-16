'use strict';
var events = require("events");
var util = require("util");
var protocol = require('./nairProtocol');
var PackageHeader = protocol.PackageHeader;
var logger = require('./logger');

function ResultParser(options) {
  this.options = options || {};
  this._buffer = null;
  this._offset = 0;
  this._debug_mode = options.debug_mode;
}

util.inherits(ResultParser, events.EventEmitter);

ResultParser.prototype.execute = function (buffer) {
  this.append(buffer);

  while (true) {

    if (this.headerRemaining()) {
      break;
    }

    var header = this.parseHeader();

    if (this.bodyRemaining(header.packetSize)) {
      this._offset -= 12; //header长度为12，这里需要复原offset
      break;
    }

    var body = this.parseBody(header);

    if (this._debug_mode) {
      logger.log(`buffer length: ${this._buffer.length}, offset: ${this._offset}`)
    }
    this.emit("reply", body);
  }


};

ResultParser.prototype.append = function (newBuffer) {
  if (!newBuffer) {
    return;
  }
  if (this._buffer === null) {
    this._buffer = newBuffer;
    return;
  }
  this._buffer = Buffer.concat([this._buffer.slice(this._offset), newBuffer]);
  this._offset = 0;
};

ResultParser.prototype.headerRemaining = function () {
  return this._buffer.length - this._offset < 8;
};

ResultParser.prototype.bodyRemaining = function (packageSize) {
  return this._buffer.length - this._offset < packageSize;
};

ResultParser.prototype.parseHeader = function () {
  var msg = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var packageId = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var packageSize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  if (this._debug_mode) {
    logger.log(`Parse header: ${msg}, ${packageId}, ${packageSize}`);
  }

  return new PackageHeader(msg, packageSize, packageId);

};

ResultParser.prototype.parseBody = function (header) {
  if (header.msg === protocol.RESPONSE_GET_MSG) {
    return this.parseGetBody(header);
  } else if (header.msg === protocol.RESPONSE_SET_MSG) {
    return this.parseSetBody(header);
  } else if (header.msg === protocol.RESPONSE_DEL_MSG) {
    return this.parseDelBody(header);
  } else if (header.msg === protocol.RESPONSE_INCR_MSG) {
    return this.parseIncrBody(header);
  } else if (header.msg === protocol.RESPONSE_GETMETA_MSG) {
    return this.parseGetMetaBody(header);
  }
};

ResultParser.prototype.parseGetBody = function (header) {
  var code = this._buffer.readUInt16LE(this._offset);
  this._offset += 2;

  var area = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var version = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var keySize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var valueSize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var key = this._buffer.toString("utf-8", this._offset, this._offset + keySize);
  this._offset += keySize;

  var value = this._buffer.toString("utf-8", this._offset, this._offset + valueSize);
  this._offset += valueSize;

  try {
    value = JSON.parse(value);
  } catch (err) { }

  return {
    packetId: header.packetId,
    success: code === 0,
    version: version,
    key: key,
    value: value
  }

};

ResultParser.prototype.parseGetMetaBody = function (header) {
  var code = this._buffer.readUInt16LE(this._offset);
  this._offset += 2;

  var version = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var expired = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  return {
    packetId: header.packetId,
    success: code === 0,
    value: {
      version: version,
      expired: expired
    }
  }

};

ResultParser.prototype.parseSetBody = function (header) {
  var code = this._buffer.readUInt16LE(this._offset);
  this._offset += 2;

  var area = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var keySize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  return {
    packetId: header.packetId,
    success: code === 0
  }

};

ResultParser.prototype.parseIncrBody = function (header) {
  var code = this._buffer.readUInt16LE(this._offset);
  this._offset += 2;

  var area = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var value = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var keySize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var key = this._buffer.toString("utf-8", this._offset, this._offset + keySize);
  this._offset += keySize;

  return {
    packetId: header.packetId,
    success: code === 0,
    key: key,
    value: value
  }

};

ResultParser.prototype.parseDelBody = function (header) {
  var code = this._buffer.readUInt16LE(this._offset);
  this._offset += 2;

  var area = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  var keySize = this._buffer.readUInt32LE(this._offset);
  this._offset += 4;

  return {
    packetId: header.packetId,
    success: code === 0
  }

};

module.exports = ResultParser;