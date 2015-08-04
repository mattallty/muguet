"use strict"

var named = require('node-named')
  , EventEmitter = require('events').EventEmitter
  , Logger = require('./logger')
  , fs = require('fs-extra')
  , path = require('path')
  , util = require('util')


var DNSServer = function (app, domain) {

  EventEmitter.call(this)

  this.domain = domain
  this.app = app
  this.entries = {}
  this.server = named.createServer({name: "Muguet DNS Server"})

  this.server.on('query', function (query) {

    var requestedDomain = query.name(),
        type = query.type()

    switch (type) {
      case 'A':

        if (this.entries[requestedDomain]) {
          var record = new named.ARecord(this.entries[requestedDomain])
          query.addAnswer(requestedDomain, record, 10)
        } else {
          Logger.error("DNS query (A) for domain %s does not match any container", requestedDomain)
        }

        this.server.send(query)
        break

      default:
        this.server.send(query)
    }

  }.bind(this))
}

util.inherits(DNSServer, EventEmitter)

/**
 * Setup the /etc/resolver/{domain} file
 * @private
 */
DNSServer.prototype._setupResolver = function (port, ip) {
  var file = path.join('/etc/resolver', this.domain)

  var contents = [
    "nameserver " + ip,
    "port " + port
  ].join("\n")

  fs.outputFile(file, contents, function () {
    Logger.debug('Resolver file %s updated', file)
  })

  return this
}

DNSServer.prototype.setEntries = function (entries) {
  this.entries = {}
  var self = this
  entries.forEach(function (entry) {
    entry.names.forEach(function (name) {
      self.entries[name] = entry.ip
    })
  })
}

DNSServer.prototype.getEntries = function () {
  return this.entries
}

DNSServer.prototype.listen = function (port, ip) {
  port = port || 9999
  this._setupResolver(port, ip)

  this.server.listen(port, '::', function () {
    Logger.info('Muguet DNS Server listening on port %d', port)
  })

  return this
}

exports.DNSServer = DNSServer
