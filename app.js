"use strict";

var   DockerWatcher = require('./lib/docker-watcher')
    , DokerContainer = require('./lib/docker-container')
    , PortHelper = require('./lib/port-helper')
    , dockerode = require('dockerode')
    , HttpProxyDriver = require('http-proxy')
    , HTTPProxy = require('./lib/http-proxy')
    , Logger = require('./lib/logger')
    , DNSServer = require('./lib/dns-server').DNSServer
    , exec = require('child_process').exec
;

var   HTTP_PROXY_DOMAIN = process.env.HTTP_PROXY_DOMAIN || 'dock.dev'
    , HTTP_PROXY_API_PORT = process.env.HTTP_PROXY_API_PORT || 9876
;

/**
 * App
 *
 * @constructor
 */
var App = function(ProxyDriver) {
    this.proxyDriver = ProxyDriver;
    // DNS stuff
    this.dnsServer = new DNSServer().listen();
    this.dnsServer.on('query', function(q) {
       console.log(arguments);
    });
    // proxy
    this.proxy = new HTTPProxy(this.proxyDriver);
};

/**
 * Run the app
 */
App.prototype.run = function () {
    Logger.info("Starting Muguet App");
    var flags = DokerContainer.IS_RUNNING | DokerContainer.HAS_PROXY_ENABLED | DokerContainer.IS_NOT_PROXY;
    var watcher = new DockerWatcher(dockerode, flags).run();
    watcher
        .on('setup', this._onContainerSetup.bind(this))
        .on('change', this._onContainerChange.bind(this))
        .on('error', this._onError.bind(this));
};

/**
 * Callback on the first containers list received
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerSetup = function(containers) {
    this.containers = containers;
    this.proxy.setRoutes(this._getRoutes());
    this.proxy.listen(HTTP_PROXY_API_PORT);
};

/**
 * Callback on containers list changes
 *
 * @param {Array} containers
 * @private
 */
App.prototype._onContainerChange = function(containers) {
    console.log("Containers have changed: %d running", containers.length);
    this.containers = containers
    this.proxy.updateRoutes(this._getRoutes());
};

/**
 * Error callback
 *
 * @param {String} err
 * @private
 */
App.prototype._onError = function(err) {
    exec('boot2docker status', function(error, stdout, stderr) {
        if (stdout.trim() === 'poweroff') {
            return Logger.error("Your boot2docker VM does not seem to be started. Please run `boot2docker up`.");
        }
        Logger.error("Error while watching containers. ("+err+")");
    });
};


/**
 * Build routes for all container
 *
 * @private
 */
App.prototype._getRoutes = function() {
    var routes = this.containers.map(this._buildContainerRoute.bind(this, this.proxy));
    if (routes.length) {
        routes = routes.reduce(function(prev, next) {
            return prev.concat(next);
        });
    }
    return routes;
};

/**
 * build single container routes
 *
 * @param {HTTPProxy} proxy
 * @param {Object} cnt
 * @private
 */
App.prototype._buildContainerRoute = function(proxy, cnt) {
    var ports = PortHelper.filter(cnt),
        port80Bound = false,
        mappedPort;

    return ports.map(function(mapping) {

        if (80 === (mappedPort = PortHelper.getMappedPort(ports, mapping, port80Bound, cnt.web_port))) {
            port80Bound = true;
        }

        var subdomain = cnt.subdomain_map && cnt.subdomain_map[mapping.PublicPort] ?
            cnt.subdomain_map[mapping.PublicPort] : cnt.subdomain;

        return this._getRouteObject(subdomain, cnt.hostname, mappedPort, mapping);

    }.bind(this));
};

/**
 * Returns a route object
 * @param cnt
 * @param mappedPort
 * @param port_mapping
 * @returns {{host: string, port: number, remote_host: string, remote_port: number}}
 * @private
 */
App.prototype._getRouteObject = function (subdomain, remote_host, mappedPort, port_mapping) {
    return {
        host : subdomain + '.' + HTTP_PROXY_DOMAIN,
        port : mappedPort,
        remote_host: remote_host,
        remote_port : port_mapping.PublicPort
    };
};

if(require.main === module) {
    var app = new App(HttpProxyDriver);
    app.run();
}

module.exports = App;