"use strict"

var EventEmitter = require('events').EventEmitter
  , Logger = require('./logger')
  , util = require('util')
  , dns = require('dns')
  , _ = require('lodash')

require('colors')

var DNSServer = function (app, driver) {

  EventEmitter.call(this)

  this.app = app
  this.driver = driver
  this.entries = {}
  this.server = this.driver.createServer({name: "Muguet DNS Server"})

  this.server.on('query', function (query) {

    var requestedDomain = query.name(),
        type = query.type()

    switch (type) {
      case 'A':

        var record;

        if (this.entries[requestedDomain]) {
          record = new this.driver.ARecord(this.entries[requestedDomain])
          query.addAnswer(requestedDomain, record, 10)
          this.server.send(query)
        } else {
          dns.resolve(requestedDomain, 'A', function (err, addresses) {
            if (addresses) {
              addresses.forEach(function (addr) {
                record = new this.driver.ARecord(addr)
                query.addAnswer(requestedDomain, record, 10)
              }.bind(this))
            } else if(err) {
              Logger.error("DNS query (A) for domain %s throw an error: " + err, requestedDomain)
            } else {
              Logger.error("DNS query (A) for domain %s does not match any ip", requestedDomain)
            }
            this.server.send(query)
          }.bind(this))
        }
        break

      default:
        this.server.send(query)
    }

  }.bind(this))
}

util.inherits(DNSServer, EventEmitter)



DNSServer.prototype.setEntries = function (entries) {

  this.entries = {}
  this.entries['muguet.' + this.app.getDomain()] = this.app.getProxyIp()

  var self = this

  _.forEach(entries, function(names, ip) {
    names.forEach(function(name) {
      self.entries[name] = ip
      Logger.info(util.format('Resolving domain %s to IP %s', name.yellow, ip.yellow))
    })
  })
}

DNSServer.prototype.getEntries = function () {
  return this.entries
}

DNSServer.prototype.getPort = function () {
  return this.port
}

DNSServer.prototype.listen = function (port) {

  this.port = port
  var self = this

  this.server
    .on('error', function() {
      Logger.error("Muguet DNS Server cannot listen on port %s", String(self.port).red)
      process.exit()
    })
    .listen(this.port, '::', function () {
    Logger.info('Muguet DNS Server listening on port %s', String(self.port).yellow)
  })

  return this
}

DNSServer.prototype.close = function () {
  this.server.close()
  return this
}

exports.DNSServer = DNSServer
