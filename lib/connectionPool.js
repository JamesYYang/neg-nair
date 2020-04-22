const NairClient = require('./nairClient');
let nairClients = [];

exports.init = (hosts, options) => {

  for(let host of hosts){
    if(!host){
      continue;
    }

    var hostInfo = host.split(':');
    if(hostInfo.length > 2){
      throw new Error(`invalid host entry ${host}`);
    }

    var hostIP = hostInfo[0];
    var port = isNaN(hostInfo[1]) ? 8887 : hostInfo[1];
    nairClients.push(new NairClient(hostIP, port, options))

  }

  if(nairClients.length === 0){
    throw new Error('init nair connection failed.');
  }

};

exports.getConnection = () => {
  var find = null;
  for(let client of nairClients){
    if(client.connected){
      if(client.waitQueue.length === 0){
        find = client;
        break;
      }else if(!find || client.waitQueue.length < find.waitQueue.length){
        find = client;
      }
    }
  }

  if(find){
    return find;
  }else{
    throw new Error('Can not find a available client.');
  }
};
