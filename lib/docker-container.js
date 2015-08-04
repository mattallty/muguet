"use strict";

var Logger = require('./logger')
  , _ = require('lodash')

/**
 * Represent a docker container
 *
 * @param {App} app basic information
 * @param {Object} docker_infos basic information
 * @param {Object} basic_info basic information
 * @param {Object} data full docker information returned by inspect()
 *
 * @constructor
 */
var DockerContainer = function (app, basic_info, data) {
  this.app = app
  this.basicInfo = basic_info
  this.data = data
  // "Dockerode" (or maybe the Docker API ?) does not return ports in the same order on subsequent calls :(
  // so we need to reorder them :)
  this.basicInfo.Ports = this.basicInfo.Ports.sort(function (a, b) {
    return a.PrivatePort < b.PrivatePort
  })

  this.basicInfo.Ports.map(function (portSpecs) {
    portSpecs.IP = this.getIPAddress()
    return portSpecs
  }.bind(this))
}

/**
 * Flags used in listing query
 */
Object.defineProperties(DockerContainer, {
  HAS_PROXY_ENABLED: {
    value: 1 // 0001
  },
  IS_RUNNING: {
    value: 2 // 0010
  },
  IS_STOPPED: {
    value: 4 // 0100
  }
})

/**
 * Return data passed in the constructor
 *
 * @returns {Object}
 */
DockerContainer.prototype.getRawData = function () {
  return this.data
}

/**
 * Return basic info passed in the constructor
 *
 * @returns {Object}
 */
DockerContainer.prototype.getBasicInfo = function () {
  return this.basicInfo
}

DockerContainer.prototype.getComparableInfos = function () {
  var infos = this.basicInfo
  delete infos.Status
  return infos
}

/**
 * Get sub-domain associated with the container.
 * Taken from the docker-compose service name or the hostname.
 *
 * @returns {String}
 */
DockerContainer.prototype.getSubDomain = function () {
  return this.getComposeService() || this.getHostname()
}

/**
 * Return the sub-domain map or null when no mapping has been defined
 *
 * @returns {Object|null}
 */
DockerContainer.prototype.getSubDomainMap = function () {

  var mapping = {},
    mapLabel = this.getLabel('org.muguet.dns.subdomain-map')

  if (!mapLabel) {
    return {}
  }

  mapLabel.split(',').forEach(function (el) {

    var parts = el.split(':')
    mapping[parts[1]] = parts[0]// + '.' + this.getSubDomain()

  }.bind(this))

  return mapping
}

/**
 *
 * @param label
 * @returns {String|null}
 */
DockerContainer.prototype.getLabel = function (label) {
  return typeof this.basicInfo.Labels[label] === 'string' ?
    this.basicInfo.Labels[label] : null
}

/**
 *
 * @param label
 * @returns {Number|null}
 */
DockerContainer.prototype.getLabelAsInt = function (label) {
  var val = this.getLabel(label)
  return val === null ? null : parseInt(val)
}

/**
 * Return the ports that should be proxied, or null if all ports should be proxied
 *
 * @returns {Array|null}
 */
DockerContainer.prototype.getPortsRestrictions = function () {
  var onlyPorts = this.getLabel('org.muguet.reverse-proxy.only-ports');
  return onlyPorts ? onlyPorts.split(',').map(Number) : null
}

/**
 * Return the container id
 *
 * @returns {String}
 */
DockerContainer.prototype.getId = function () {
  return this.basicInfo.Id
}

/**
 * Return the container image name
 *
 * @returns {String}
 */
DockerContainer.prototype.getImage = function () {
  return this.basicInfo.Image
}

/**
 * Get created date
 *
 * @returns {string}
 */
DockerContainer.prototype.getCreatedDate = function () {
  return new Date(this.basicInfo.Created * 1000).toJSON()
}

/**
 * Check if the container is running
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.isRunning = function () {
  return this.data.State.Running
}

/**
 * Check if the container should be proxified
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.shouldBeProxified = function () {
  return Boolean(parseInt(this.getLabel('org.muguet.reverse-proxy.enabled') || 0))
}

/**
 * Get IP address
 *
 * @returns {String}
 */
DockerContainer.prototype.getIPAddress = function () {
  return this.data.NetworkSettings.IPAddress
}

/**
 * Return Hostname
 *
 * @returns {String}
 */
DockerContainer.prototype.getHostname = function () {
  return this.data.Config.Hostname
}

/**
 * Get ports
 *
 * @returns {Array}
 */
DockerContainer.prototype.getPorts = function () {
  return this.basicInfo.Ports
}

/**
 * Get prioritized web port
 *
 * @returns {Number|null}
 */
DockerContainer.prototype.getWebPort = function () {
  return this.basicInfo.Labels['org.dc.http-proxy.web-port'] ?
    parseInt(this.basicInfo.Labels['org.dc.http-proxy.web-port']) : null
}

/**
 * Get compose service
 *
 * @returns {String|null}
 */
DockerContainer.prototype.getComposeService = function () {
  return this.getLabel('com.docker.compose.service')
}


/**
 * Get compose container number
 *
 * @returns {Number|null}
 */
DockerContainer.prototype.getComposeContainerNumber = function () {
  return this.getLabelAsInt('com.docker.compose.container-number')
}


/**
 *
 * @param domain
 * @returns {Array}
 */
DockerContainer.prototype.getDnsEntries = function (domain) {

  var ports = this.getPorts();

  var entries = ports.map(function (portSpecs) {

    var hostname = this.getProxiedHostname(portSpecs.PrivatePort, domain),
      aliases = this.getHostnameAliases(domain, portSpecs.PrivatePort)

    return {
      ip : this.shouldBeProxified() ? this.app.getProxyIp() : this.getIPAddress(),
      names : [hostname].concat(aliases)
    }

  }.bind(this))

  return entries
}

/**
 * build single container routes
 *
 * @param {HTTPProxy} proxy
 * @param {DockerContainer} cnt
 * @private
 */
DockerContainer.prototype.getProxyRoutes = function (domain) {

  var ports = this.getProxifiedPorts(),
      port80Bound = {}

  var routes = ports.map(function (portSpecs) {

    var hostname = this.getProxiedHostname(portSpecs.PrivatePort, domain),
        aliases = this.getHostnameAliases(domain, portSpecs.PrivatePort),
        mappedPort = port80Bound[hostname] = port80Bound[hostname] ? portSpecs.PublicPort : 80

    return this._getRouteObject(hostname, aliases, this.getIPAddress(), mappedPort, portSpecs)

  }.bind(this))

  return routes
}

DockerContainer.prototype.getProxiedHostname = function (port, domain) {
  return this.getExtendedSubDomain(port) + '.' + domain
}

DockerContainer.prototype.getExtendedSubDomain = function (port) {
  return this.getMappedSubDomainByPort(port, '.') + this.getSubDomain()
}

DockerContainer.prototype.getHostnameAliases = function (domain, port) {
  var subDomain = this.getMappedSubDomainByPort(port, '.')
  return _.uniq([
    subDomain + this.getHostname() + '.' + domain,
    subDomain + this.getId().substr(0, 12) + '.' + domain
  ])
}

/**
 *
 * @param port
 * @returns {string} can be empty
 */
DockerContainer.prototype.getMappedSubDomainByPort = function (port, suffix) {
  var subDomainMap = this.getSubDomainMap()
  return subDomainMap[port] ? subDomainMap[port] + suffix : ''
}

/**
 *
 * @param {DockerContainer} cnt
 * @returns {Array}
 */
DockerContainer.prototype.getProxifiedPorts = function () {

  var filterNonTcpPorts = function (port_mapping) {
    return port_mapping.Type === 'tcp'
  }

  var filterByPolicy = function (port_mapping) {
    var restrictions = this.getPortsRestrictions()
    if (restrictions && restrictions.indexOf(port_mapping.PrivatePort) === -1) {
      var msg = "Filtering tcp port %d beause of 'only-ports' policy (%s) for container '%s'"
      Logger.debug(msg, port_mapping.PrivatePort, restrictions, this.getSubDomain())
      return false
    }
    return true
  }.bind(this)

  return this.getPorts()
    .filter(filterNonTcpPorts)
    .filter(filterByPolicy)
}


/**
 * Returns a route object
 *
 * @param hostname
 * @param hostname_aliases
 * @param container_addr
 * @param mappedPort
 * @param port_mapping
 * @returns {{host: string, port: number, remote_host: string, remote_port: number}}
 * @private
 */
DockerContainer.prototype._getRouteObject = function (hostname, hostname_aliases, container_addr, mappedPort, port_mapping) {
  return {
    hostname: hostname,
    hostname_aliases: hostname_aliases,
    port: mappedPort,
    container_public_addr: this.app.getDockerInfos().hostname,
    container_public_port: port_mapping.PublicPort,
    container_private_addr: container_addr,
    container_private_port: port_mapping.PrivatePort
  }
}

module.exports = DockerContainer