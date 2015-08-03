"use strict";

var Logger = require('./logger')
  , _ = require('lodash')

/**
 * Represent a docker container
 *
 * @param {Object} docker_infos basic information
 * @param {Object} basic_info basic information
 * @param {Object} data full docker information returned by inspect()
 *
 * @constructor
 */
var DockerContainer = function (docker_infos, basic_info, data) {
  this.dockerInfos = docker_infos
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
    mapLabel = this.getLabel('org.muguet.reverse-proxy.subdomain-map')

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
 * Get ENV vars
 *
 * @returns {Object}
 */
DockerContainer.prototype.getEnvVars = function () {
  var env = {}
  this.data.Config.Env.forEach(function (e) {
    var parts = e.split('=', 2)
    env[parts[0]] = parts[1]
  })
  return env
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
 * Check if a port should be proxified
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.portShouldBeProxified = function (port) {

  if (!this.shouldBeProxified()) {
    return false
  }

  var onlyPorts = this.getPortsRestrictions()
  if (onlyPorts && onlyPorts.indexOf(port) === -1) {
    return false
  }

  return true;
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
 * build single container routes
 *
 * @param {HTTPProxy} proxy
 * @param {DockerContainer} cnt
 * @private
 */
DockerContainer.prototype.getProxyRoutes = function (domain) {

  var ports = this.getProxifiedPorts(),
      port80Bound = {},
      subDomainMap = this.getSubDomainMap(),
      defaultSubdomain = this.getSubDomain()

  var routes = ports.map(function (portSpecs) {

    var subdomainExtended = subDomainMap[portSpecs.PrivatePort] ?
                      subDomainMap[portSpecs.PrivatePort] + '.' + this.getSubDomain() : defaultSubdomain,
        hostnames = _.uniq([
          subdomainExtended + '.' + domain,
          (subDomainMap[portSpecs.PrivatePort] ? subDomainMap[portSpecs.PrivatePort] + '.' : '') + this.getHostname() + '.' + domain,
          (subDomainMap[portSpecs.PrivatePort] ? subDomainMap[portSpecs.PrivatePort] + '.' : '') + this.getId().substr(0, 12) + '.' + domain
        ]),
        mappedPort = port80Bound[hostnames[0]] = port80Bound[hostnames[0]] ? portSpecs.PublicPort : 80

    return this._getRouteObject(hostnames, this.getIPAddress(), mappedPort, portSpecs)

  }.bind(this))

  return routes
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
      var msg = "Filtering tcp port %d by only-ports policy %s for container %s"
      Logger.info(msg, port_mapping.PrivatePort, restrictions, this.getComposeService())
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
 * @param hostnames
 * @param container_addr
 * @param mappedPort
 * @param port_mapping
 * @returns {{host: string, port: number, remote_host: string, remote_port: number}}
 * @private
 */
DockerContainer.prototype._getRouteObject = function (hostnames, container_addr, mappedPort, port_mapping) {
  return {
    hostnames: hostnames,
    port: mappedPort,

    container_public_addr: this.dockerInfos.hostname,
    container_public_port: port_mapping.PublicPort,

    container_private_addr: container_addr,
    container_private_port: port_mapping.PrivatePort,

    remote_host: container_addr,
    remote_port: port_mapping.PublicPort
  }
}

module.exports = DockerContainer