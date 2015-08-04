"use strict";

var exec = require('child_process').exec
  , Logger = require('./logger')


var Network = {

  setupLoopback : function (ip) {

    ip = ip || '10.254.254.254'

    exec('ifconfig lo0 alias ' + ip, function (error) {
      if (error) {
        return Logger.error(error)
      }
    })
  }
}

module.exports = Network