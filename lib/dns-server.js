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

    var domain = query.name(),
        type = query.type()

    switch (type) {
      case 'A':

        if (this.entries[domain]) {
          var record = new named.ARecord(this.entries[domain])
          query.addAnswer(domain, record, 10)
          Logger.debug("Replying to DNS query (A) for domain %s with IP %s", domain, this.entries[domain])
        } else {
          Logger.error("DNS query (A) for domain %s does not match any container", domain)
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

DNSServer.prototype.listen = function (port, ip) {
  port = port || 9999
  this._setupResolver(port, ip)

  this.server.listen(port, '::', function () {
    Logger.info('Muguet DNS Server listening on port %d', port)
  })

  return this
}

exports.DNSServer = DNSServer
