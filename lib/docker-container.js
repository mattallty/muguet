"use strict";

/**
 * Represent a docker container
 *
 * @param {Object} basic_info basic information
 * @param {Object} data full docker information returned by inspect()
 *
 * @constructor
 */
var DockerContainer = function (basic_info, data) {
    this._basic_info = basic_info;
    this._data = data;
    // "Dockerode" (or maybe the Docker API ?) does not return ports in the same order on subsequent calls :(
    // so we need to reorder them :)
    this._basic_info.Ports = this._basic_info.Ports.sort(function(a, b) {
        return a.PrivatePort < b.PrivatePort;
    });
};

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
    IS_PROXY: {
        value: 4 // 0100
    },
    IS_STOPPED: {
        value: 8 // 1000
    },
    IS_NOT_PROXY: {
        value: 16 // 10000
    }
});

/**
 * Return data passed in the constructor
 *
 * @returns {Object}
 */
DockerContainer.prototype.getRawData = function () {
    return this._data;
};

/**
 * Return basic info passed in the constructor
 *
 * @returns {Object}
 */
DockerContainer.prototype.getBasicInfo = function () {
    return this._basic_info;
};

/**
 * Get sub-domain associated with the container.
 * We first check the 'org.dc.http-proxy.sub-domain' label,
 * then the docker-compose service name, and finally the hostname.
 *
 * @returns {String}
 */
DockerContainer.prototype.getSubDomain = function () {
    return  this._basic_info.Labels['org.dc.http-proxy.sub-domain']
        ||  this.getComposeService()
        ||  this.getHostname()
};

/**
 * Return the sub-domain map or null when no mapping has been defined
 *
 * @returns {Object|null}
 */
DockerContainer.prototype.getSubDomainMap = function () {
    var mapping = {};
    for (var n in this._basic_info.Labels) {
        if (n.substr(0, 23) === 'org.dc.http-proxy.port-') {
            var parts = n.split('-');
            mapping[parts[parts.length - 2]] = this._basic_info.Labels[n];
        }
    }
    return Object.keys(mapping).length > 0 ? mapping : null;
};

/**
 * Return the ports that should be proxied, or null if all ports should be proxied
 *
 * @returns {Array|null}
 */
DockerContainer.prototype.getPortsRestriction = function () {
    return  this._basic_info.Labels['org.dc.http-proxy.only-ports'] ?
        this._basic_info.Labels['org.dc.http-proxy.only-ports'].split(',').map(function(port) {
            return parseInt(port);
        }) :
        null
};

/**
 * Return the container id
 *
 * @returns {String}
 */
DockerContainer.prototype.getId = function () {
    return this._basic_info.Id;
};

/**
 * Return the container image name
 *
 * @returns {String}
 */
DockerContainer.prototype.getImage = function () {
    return this._basic_info.Image;
};

/**
 * Get created date
 *
 * @returns {string}
 */
DockerContainer.prototype.getCreatedDate = function () {
    return new Date(this._basic_info.Created * 1000).toJSON();
};

/**
 * Check if the container is running
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.isRunning = function () {
    return this._data.State.Running;
};


/**
 * Get ENV vars
 *
 * @returns {Object}
 */
DockerContainer.prototype.getEnvVars = function () {
    var env = {};
    this._data.Config.Env.forEach(function(e){
        var parts = e.split('=', 2);
        env[parts[0]] = parts[1];
    });
    return env;
};

/**
 * Check if the container is the proxy
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.isProxy = function () {
    return Boolean(this.getEnvVars().DOCKER_HTTP_REVERSE_PROXY || 0);
};

/**
 * Check if the container should be proxified
 *
 * @returns {Boolean}
 */
DockerContainer.prototype.shouldBeProxified = function () {
    return Boolean(parseInt(this._basic_info.Labels['org.dc.http-proxy.enabled'] || 0));
};

/**
 * Get IP address
 *
 * @returns {String}
 */
DockerContainer.prototype.getIPAddress = function () {
    return this._data.NetworkSettings.IPAddress;
};

/**
 * Return Hostname
 *
 * @returns {String}
 */
DockerContainer.prototype.getHostname = function () {
    return this._data.Config.Hostname;
};

/**
 * Get ports
 *
 * @returns {Array}
 */
DockerContainer.prototype.getPorts = function () {
    return this._basic_info.Ports;
};

/**
 * Get prioritized web port
 *
 * @returns {Number|null}
 */
DockerContainer.prototype.getWebPort = function () {
    return this._basic_info.Labels['org.dc.http-proxy.web-port'] ?
            parseInt(this._basic_info.Labels['org.dc.http-proxy.web-port']) : null;
};

/**
 * Get compose service
 *
 * @returns {String|null}
 */
DockerContainer.prototype.getComposeService = function () {
    return this._basic_info.Labels['com.docker.compose.service'] || null;
};


/**
 * Get compose container number
 *
 * @returns {Number|null}
 */
DockerContainer.prototype.getComposeContainerNumber = function () {
    return this._basic_info.Labels['com.docker.compose.container-number'] ?
            parseInt(this._basic_info.Labels['com.docker.compose.container-number']) : null;
};

module.exports = DockerContainer;