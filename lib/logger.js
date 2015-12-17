'use strict';

var logger = console;

exports.setLogger = (log) => logger = log;

var methods = ['error', 'info', 'log', 'trace', 'warn'];

for(let m of methods){
  exports[m] = function() {
    logger[m].apply(null, arguments);
  } ;
}