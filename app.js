"use strict";

var DockerWatcher = require('./lib/docker-watcher')
  , DokerContainer = require('./lib/docker-container')
  , dockerode = require('dockerode')
  , url = require('url')
  , HttpProxyDriver = require('http-proxy')
  , HTTPProxy = require('./lib/http-proxy')
  , Logger = require('./lib/logger')
  , DNSServer = require('./lib/dns-server').DNSServer
  , exec = require('child_process').exec

/**
 * App
 *
 * ProxyDriver, domain, dns_ip, dns_port
 *
 * @constructor
 */
var App = function (ProxyDriver, domain, api_port, dns_ip, dns_port) {

  this.dockerInfos = url.parse(process.env.DOCKER_HOST)
  this.proxyDriver = ProxyDriver
  this.domain = domain
  this.apiPort = api_port
  this.dnsIP = dns_ip
  this.dnsPort = dns_port

  // DNS stuff
  this.dnsServer = new DNSServer(domain, this);
  this.dnsServer.listen(dns_port, dns_ip)

  // proxy
  this.proxy = new HTTPProxy(this.proxyDriver)
}

/**
 * Run the app
 */
App.prototype.run = function () {
  Logger.info("Starting Muguet App")
  var flags = DokerContainer.IS_RUNNING | DokerContainer.HAS_PROXY_ENABLED | DokerContainer.IS_NOT_PROXY
  var watcher = new DockerWatcher(dockerode, this.dockerInfos, flags).run()
  watcher
    .on('setup', this._onContainerSetup.bind(this))
    .on('change', this._onContainerChange.bind(this))
    .on('error', this._onError.bind(this))
}

/**
 * Callback on the first containers list received
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerSetup = function (containers) {
  Logger.info('Containers list received from Docker-watcher: %d containers found', containers.length)
  this.containers = containers
  console.dir(this.getProxyRoutes());
  //this.proxy.setRoutes(this.getProxyRoutes())
  this.proxy.listen(this.apiPort)
}

/**
 * Callback on containers list changes
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerChange = function (containers) {
  console.log("Containers have changed: %d running", containers.length)
  this.containers = containers
  this.proxy.updateRoutes(this.getProxyRoutes())
}

/**
 * Error callback
 *
 * @param {String} err
 * @private
 */
App.prototype._onError = function (err) {
  exec('boot2docker status', function (error, stdout, stderr) {
    if (stdout.trim() === 'poweroff') {
      return Logger.error("Your boot2docker VM does not seem to be started. Please run `boot2docker up`.");
    }
    Logger.error("Error while watching containers. (" + err + ")")
  })
}


/**
 * Build routes for all container
 *
 * @private
 */
App.prototype.getProxyRoutes = function () {

  var routes = this.containers.map(function (cnt) {
    return cnt.getProxyRoutes(this.domain)
  }.bind(this))

  if (routes.length) {
    routes = routes.reduce(function (prev, next) {
      return prev.concat(next)
    })
  }
  console.dir(routes)
  return routes
}

if (require.main === module) {
  var app = new App(HttpProxyDriver)
  app.run()
}

module.exports = App