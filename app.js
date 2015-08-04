"use strict";

var DockerWatcher = require('./lib/docker-watcher')
  , DockerContainer = require('./lib/docker-container')
  , ContainersHelper = require('./lib/containers-helper')
  , dockerode = require('dockerode')
  , url = require('url')
  , HTTPProxy = require('./lib/http-proxy')
  , Logger = require('./lib/logger')
  , DNSServer = require('./lib/dns-server').DNSServer
  , exec = require('child_process').exec

require('colors')

/**
 * App
 *
 * ProxyDriver, domain, dns_ip, dns_port
 *
 * @constructor
 */
var App = function (ProxyDriver, HTTPDriver, DNSDriver, domain, api_port, proxy_ip, dns_ip, dns_port) {

  this.dockerInfos = url.parse(process.env.DOCKER_HOST)
  this.proxyDriver = ProxyDriver
  this.httpDriver = HTTPDriver
  this.dnsDriver = DNSDriver
  this.domain = domain
  this.apiPort = api_port
  this.proxyIp = proxy_ip
  this.dnsIp = dns_ip
  this.dnsPort = dns_port

  // DNS stuff
  this.dnsServer = new DNSServer(this, this.dnsDriver, domain);

  // proxy
  this.proxy = new HTTPProxy(this.proxyDriver, this.httpDriver, this.dnsServer)
}

/**
 * Return docker infos
 * @returns {Object}
 */
App.prototype.getDockerInfos = function () {
  return this.dockerInfos
}

/**
 * Run the app
 */
App.prototype.run = function () {
  Logger.info("Starting Muguet App".green)
  this.dnsServer.listen(this.dnsPort, this.dnsIp)
  var watcher = new DockerWatcher(this, dockerode, this.dockerInfos).run()
  watcher
    .on('setup', this._onContainerSetup.bind(this))
    .on('change', this._onContainerChange.bind(this))
    .on('error', this._onError.bind(this))
}

/**
 * Gte proxy IP address
 * @returns {String}
 */
App.prototype.getProxyIp = function () {
  return this.proxyIp
}

/**
 * Callback on the first containers list received
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerSetup = function (containers) {
  Logger.info('Containers list received from Docker-watcher: %s containers found', String(containers.length).yellow)
  this.containers = containers
  this.dnsServer.setEntries(this.getDnsEntries())
  this.proxy.setRoutes(this.getProxyRoutes())
  this.proxy.listen(this.apiPort)
}

/**
 * Callback on containers list changes
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerChange = function (containers) {
  Logger.info("Containers have changed: %s running", String(containers.length).yellow)
  this.containers = containers
  this.dnsServer.setEntries(this.getDnsEntries())
  this.proxy.updateRoutes(this.getProxyRoutes())
}

/**
 * Error callback
 *
 * @param {String} err
 * @private
 */
App.prototype._onError = function (err) {
  exec('boot2docker status', function (error, stdout) {
    if (stdout.trim() === 'poweroff') {
      return Logger.error("Your boot2docker VM does not seem to be started. Please run `boot2docker up`.");
    }
    Logger.error("Error while watching containers. (" + err + ")")
  })
}


/**
 * Build proxy routes for all container
 *
 * @private
 */
App.prototype.getProxyRoutes = function () {

  var flags = DockerContainer.IS_RUNNING | DockerContainer.HAS_PROXY_ENABLED | DockerContainer.HAS_EXPOSED_PORTS;

  var routes = ContainersHelper.filterContainers(this.containers, flags).map(function (cnt) {
    return cnt.getProxyRoutes(this.domain)
  }.bind(this))

  if (routes.length) {
    routes = routes.reduce(function (prev, next) {
      return prev.concat(next)
    })
  }
  return routes
}
/**
 * Build dns entries
 *
 * @private
 */
App.prototype.getDnsEntries = function () {

  var entries = this.containers.map(function (cnt) {
    return cnt.getDnsEntries(this.domain)
  }.bind(this))

  if (entries.length) {
    entries = entries.reduce(function (prev, next) {
      return prev.concat(next)
    })
  }

  return entries
}

module.exports = App