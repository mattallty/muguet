"use strict";

var Logger = require('./logger')
  , path = require('path')
  , fs = require('fs-extra')


var Network = {

  routePaquets : function () {

  },

  /**
   * Setup the /etc/resolver/{domain} file
   * @private
   */
  setupResolver : function (domain, port, ip) {

    var file = path.join('/etc/resolver', domain)

    var contents = [
      "nameserver " + ip,
      "port " + port + "\n"
    ].join("\n")

    fs.outputFile(file, contents, function () {
      Logger.debug('Resolver file %s updated', file)
    })

    process.stdin.resume();

    var onExit = function() {
      Logger.info('Removing resolver file %s', file)
      fs.unlinkSync(file)
      process.exit(0)
    }

    process.on('SIGINT', onExit)
    process.on('SIGTERM', onExit)

    return this
  }
}

module.exports = Network