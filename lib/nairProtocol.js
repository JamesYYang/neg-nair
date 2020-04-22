const REQUEST_SET_MSG = 1;
const RESPONSE_SET_MSG = 2;
const REQUEST_GET_MSG = 3;
const RESPONSE_GET_MSG = 4;
const REQUEST_DEL_MSG = 5;
const RESPONSE_DEL_MSG = 6;
const REQUEST_INCR_MSG = 161;
const RESPONSE_INCR_MSG = 162;
const REQUEST_GETMETA_MSG = 163;
const RESPONSE_GETMETA_MSG = 164;

exports.REQUEST_SET_MSG = REQUEST_SET_MSG;
exports.RESPONSE_SET_MSG = RESPONSE_SET_MSG;
exports.REQUEST_GET_MSG = REQUEST_GET_MSG;
exports.RESPONSE_GET_MSG = RESPONSE_GET_MSG;
exports.REQUEST_DEL_MSG = REQUEST_DEL_MSG;
exports.RESPONSE_DEL_MSG = RESPONSE_DEL_MSG;
exports.REQUEST_INCR_MSG = REQUEST_INCR_MSG;
exports.RESPONSE_INCR_MSG = RESPONSE_INCR_MSG;
exports.REQUEST_GETMETA_MSG = REQUEST_GETMETA_MSG;
exports.RESPONSE_GETMETA_MSG = RESPONSE_GETMETA_MSG;

//package id使用10000以内的随机数
let getRandomPacketId = () => {
  return Math.floor(Math.random() * 10000);
};

function PackageHeader(msg, packetSize, packetId){
  this.msg = msg;
  this.packetId = packetId || getRandomPacketId();
  this.packetSize = packetSize;
  this.length = 12;
}

PackageHeader.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(12);
  buffer.writeUInt32LE(this.msg, 0);
  buffer.writeUInt32LE(this.packetId, 4);
  buffer.writeUInt32LE(this.packetSize, 8);
  return buffer;
};

function ReqGetPackage (area, key){
  this.area = area;
  this.key = key;
  this.keySize = Buffer.byteLength(key);
  this.packageSize = 8 + this.keySize;
  this.header = new PackageHeader(REQUEST_GET_MSG, this.packageSize);
}

ReqGetPackage.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(this.packageSize);
  buffer.writeUInt32LE(this.area, 0);
  buffer.writeUInt32LE(this.keySize, 4);
  buffer.write(this.key, 8);
  var totalSize = this.header.length + this.packageSize;
  return Buffer.concat([this.header.toBuffer(), buffer], totalSize);
};

function ReqGetMetaPackage (area, key){
  this.area = area;
  this.key = key;
  this.keySize = Buffer.byteLength(key);
  this.packageSize = 8 + this.keySize;
  this.header = new PackageHeader(REQUEST_GETMETA_MSG, this.packageSize);
}

ReqGetMetaPackage.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(this.packageSize);
  buffer.writeUInt32LE(this.area, 0);
  buffer.writeUInt32LE(this.keySize, 4);
  buffer.write(this.key, 8);
  var totalSize = this.header.length + this.packageSize;
  return Buffer.concat([this.header.toBuffer(), buffer], totalSize);
};

function ReqSetPackage (area, key, value, expired){
  this.area = area;
  this.key = key;
  this.value = value;
  this.expired = expired;
  this.version = 0;
  this.keySize = Buffer.byteLength(key);
  this.valueSize = Buffer.byteLength(value);
  this.packageSize = 20 + this.keySize + this.valueSize;
  this.header = new PackageHeader(REQUEST_SET_MSG, this.packageSize);
}

ReqSetPackage.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(this.packageSize);
  buffer.writeUInt32LE(this.area, 0);
  buffer.writeUInt32LE(this.expired, 4);
  buffer.writeUInt32LE(this.version, 8);
  buffer.writeUInt32LE(this.keySize, 12);
  buffer.writeUInt32LE(this.valueSize, 16);
  buffer.write(this.key, 20);
  buffer.write(this.value, 20 + this.keySize);
  var totalSize = this.header.length + this.packageSize;
  return Buffer.concat([this.header.toBuffer(), buffer], totalSize);
};

function ReqIncrPackage (area, key, value, defaultValue, expired){
  this.area = area;
  this.key = key;
  this.value = value;
  this.defaultValue = defaultValue;
  this.expired = expired;
  this.keySize = Buffer.byteLength(key);
  this.packageSize = 20 + this.keySize;
  this.header = new PackageHeader(REQUEST_INCR_MSG, this.packageSize);
}

ReqIncrPackage.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(this.packageSize);
  buffer.writeUInt32LE(this.area, 0);
  buffer.writeUInt32LE(this.expired, 4);
  buffer.writeUInt32LE(this.value, 8);
  buffer.writeUInt32LE(this.defaultValue, 12);
  buffer.writeUInt32LE(this.keySize, 16);
  buffer.write(this.key, 20);
  var totalSize = this.header.length + this.packageSize;
  return Buffer.concat([this.header.toBuffer(), buffer], totalSize);
};

function ReqDelPackage (area, key){
  this.area = area;
  this.key = key;
  this.keySize = Buffer.byteLength(key);
  this.packageSize = 8 + this.keySize;
  this.header = new PackageHeader(REQUEST_DEL_MSG, this.packageSize);
}

ReqDelPackage.prototype.toBuffer = function (){
  var buffer = Buffer.allocUnsafe(this.packageSize);
  buffer.writeUInt32LE(this.area, 0);
  buffer.writeUInt32LE(this.keySize, 4);
  buffer.write(this.key, 8);
  var totalSize = this.header.length + this.packageSize;
  return Buffer.concat([this.header.toBuffer(), buffer], totalSize);
};

exports.ReqGetPackage = ReqGetPackage;
exports.ReqGetMetaPackage = ReqGetMetaPackage;
exports.PackageHeader = PackageHeader;
exports.ReqSetPackage = ReqSetPackage;
exports.ReqDelPackage = ReqDelPackage;
exports.ReqIncrPackage = ReqIncrPackage;