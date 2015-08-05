"use strict";

var http = require('http')
  , measured = require('measured')
  , Logger = require('./logger')
  , sprintf = require('util').format

require('colors')

/**
 *
 * @constructor
 */
var HTTPProxy = function (app, httpProxyDriver, httpDriver, dns_server) {
  this.app = app
  this.portToServerMap = {}
  this.routes = []
  this.stats = {}
  this.httpDriver = httpDriver
  this.proxy = httpProxyDriver.createProxyServer({})
  this.dnsServer = dns_server
}

/**
 * Add route(s)
 *
 * @param {Array} routes
 */
HTTPProxy.prototype.setRoutes = function (routes) {
  this.routes = routes
  routes.forEach(function (route) {
    Logger.info("Enabling proxy for " + route.hostname.yellow)
  });
}

HTTPProxy.prototype.updateRoutes = function (routes) {
  // Get old ports to listen on
  var old_ports = this._getListeningPortsFromRoutes(this.routes)

  // New ports
  var new_ports = this._getListeningPortsFromRoutes(routes)

  // removed ports
  var diff_removed = old_ports.filter(function (port) {
    return new_ports.indexOf(port) < 0
  })

  // added ports
  var diff_added = new_ports.filter(function (port) {
    return old_ports.indexOf(port) < 0
  })

  // add new proxies
  diff_added.forEach(this._createProxyServer.bind(this))

  // rest routes
  this.routes = routes

  // close proxies that are not used anymore
  diff_removed.forEach(this._closeProxyByPort.bind(this))
  diff_removed.forEach(this._removeStatsByPort.bind(this))
}

HTTPProxy.prototype._closeProxyByPort = function (port) {
  Logger.info("Closing proxy listening on port %d", port)
  if (this.portToServerMap[port]) {
    this.portToServerMap[port].close()
    delete this.portToServerMap[port]
  }
}

HTTPProxy.prototype._removeStatsByPort = function (port) {
  for (var host_port in this.stats) {
    var p = host_port.split(':')[1]
    if (parseInt(p) === port) {
      Logger.info("Removing stats for host:port %s", host_port)
      delete this.stats[host_port]
    }
  }
}

HTTPProxy.prototype._getListeningPortsFromRoutes = function (routes) {
  return routes
    .map(function (route) {
      return route.port
    })
    .filter(function (value, index, self) {
      return self.indexOf(value) === index
    })
}

/**
 * Get routes
 *
 * @returns {Array}
 */
HTTPProxy.prototype.getRoutes = function (withstats) {
  if (!withstats) {
    return this.routes
  }
  return this.routes.map(function (route) {
    route.stats = this.stats[route.hostname + ':' + route.port] || {}
    return route
  }.bind(this))
}

HTTPProxy.prototype.getProxiedDomains = function() {
  return this.routes.map(function (route) {
    var url = 'http://' + route.hostname + ':' + route.port
    return sprintf('<a href="%s">%s</a>', url, url)
  }.bind(this))
}

/**
 * Get route for request
 *
 * @param req
 * @param port
 * @returns {object}
 */
HTTPProxy.prototype.getRouteForRequest = function (req, port) {
  var route = this.routes.filter(
    function (r) {
      return (r.hostname === req.headers.host || r.hostname_aliases.indexOf(req.headers.host) !== -1) && r.port === port
    }
  )
  // if no route found, return false
  return route.length ? route[0] : false
}

/**
 * Update stats counters
 *
 * @param req
 * @param port
 */
HTTPProxy.prototype.updateRequestsStats = function (req, port) {
  var key = req.headers.host + ':' + port

  if (!this.stats[key]) {
    this.stats[key] = measured.createCollection()
  }

  this.stats[key].meter('requestsPerSecond').mark()
}

/**
 * Proxy the request to the right route
 *
 * @param req
 * @param res
 * @param port
 * @private
 */
HTTPProxy.prototype.proxyRequest = function (req, res, port) {
  // get the route
  var route = this.getRouteForRequest(req, port)

  if (!route) {
    console.warn("No route found for request %s:%d", req.headers.host, port)
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/html')
    res.end('<style>h2, p { font-family:helvetica, Arial, sans-serif }</style><h2>404 Not found: No route matching your request</h2><p>See <a href="/proxy-routes">available routes</a>.')
    return
  }

  // update stats
  this.updateRequestsStats(req, port)

  // proxify request
  this.proxy.web(req, res, {target: 'http://' + route.container_public_addr + ':' + route.container_public_port})
}

HTTPProxy.prototype._createProxyServer = function (local_port) {

  if (!this.portToServerMap[local_port]) {

      this.portToServerMap[local_port] = http.createServer()
        .on('request', function (req, res) {
          this.proxyRequest(req, res, local_port)
        }.bind(this))
        .on('error', function() {
          Logger.error("Muguet proxy cannot listen on port %s", String(local_port).red)
          process.exit()
        })
        .listen(local_port, function() {
          Logger.info("Muguet proxy listening on port %s", String(local_port).yellow)
        })
  }

  return this.portToServerMap[local_port]
}

/**
 * Fake listen to map nodejs classical server APIs
 */
HTTPProxy.prototype.listen = function (stats_port) {

  var self = this

  this.routes.forEach(function (rule) {
    self._createProxyServer(rule.port)
  })

  if (stats_port) {

    var statsServer = http.createServer()

    statsServer.on('request', function (req, res) {

      var contentType = 'application/json',
        responseData = ''

      switch (req.url) {

        // --- HOME ---
        case '/':
          contentType = 'text/html'
          var dnsEntries = [],
              entries = self.dnsServer.getEntries()
          for (var name in entries) {
            dnsEntries.push(name + ' &#8594; ' + entries[name])
          }
          responseData = [
            '<style>body { font-family: Helvetica Neue, Helvetica, Arial; font-size:0.9em} a, a:visited {color:#5EA53A} a:hover{color:#2D6626} #main {width:400px; margin:60px auto; } #json {list-style-type: square; margin: -16px 0 20px 0; padding:0 !important; text-align: center; font-size:85%} #json li {display:inline-block; min-width:170px; margin-right: 4px; text-align: center} #json li:first-child {margin-left:48px} #json li:last-child {margin-right: 0} img {width:100%; height: auto} p {text-align:center; font-size:80%; margin-top:40px; line-height: 1.3} b.big {font-size:110%}</style>',
            '<html><head><title>Muguet</title></head><body>',
            '<div id="main">',
            '<img src="https://raw.githubusercontent.com/mattallty/muguet/master/assets/muguet.png" border="0" />',
            '<ul id="json">',
            '<li><a href="/proxy-routes">Reverse Proxy Routes (JSON)</a></li>',
            '<li><a href="/dns-entries">DNS entries (JSON)</a></li>',
            '</ul>',
            '<p>',
            'Domain set to <b>' + self.app.getDomain() + '</b><br />',
            'Proxy server listening on ports <b>' + Object.keys(self.portToServerMap).join(', ') + '</b><br />',
            'DNS server listening on port <b>' + self.dnsServer.getPort() + '</b><br />',
            '</p>',
            '<p>',
            '<b class="big">Proxied domains</b><br />' + self.getProxiedDomains().join('<br />'),
            '</p>',
            '<p>',
            '<b class="big">DNS entries</b><br />' + dnsEntries.join('<br />'),
            '</p>',
            '<p>',
            '<a href="https://github.com/mattallty/muguet">Muguet v' + self.app.version + '</a>',
            '</p>',
            '</div>'
          ].join('')
          break

        case '/dns-entries':
          responseData = JSON.stringify(self.dnsServer.getEntries())
          break

        // --- ROUTES ---
        case '/proxy-routes':
          responseData = JSON.stringify(self.getRoutes(true))
          break
      }

      // response
      res.setHeader("Content-Type", contentType)
      res.end(responseData)
    })

    statsServer.on('error', function(err) {
      Logger.error("Error listening port " + String(stats_port).red);
      Logger.error(err);
    })
    statsServer.listen(stats_port, function () {
      Logger.info("Muguet REST API listening on port %s", String(stats_port).yellow)
    })
  }
}

module.exports = HTTPProxy
