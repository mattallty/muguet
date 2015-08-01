"use strict";

var DockerContainer = require('./docker-container');

var ContainersHelper = function () {

};

/**
 * Filter containers retrieving only running, enabled and skipping proxy
 *
 * @param {DockerContainer[]} containers
 * @returns {Array}
 * @private
 */
ContainersHelper.prototype.filterContainers = function(containers, flags) {

    if (flags & DockerContainer.HAS_PROXY_ENABLED) {
        containers = containers.filter(function(cnt) {
            return  cnt.shouldBeProxified();
        });
    }

    if (flags & DockerContainer.IS_RUNNING) {
        containers = containers.filter(function(cnt) {
            return  cnt.isRunning();
        });
    }

    if (flags & DockerContainer.IS_STOPPED) {
        containers = containers.filter(function(cnt) {
            return !cnt.isRunning();
        });
    }

    if (flags & DockerContainer.IS_PROXY) {
        containers = containers.filter(function(cnt) {
            return  cnt.isProxy();
        });
    }

    if (flags & DockerContainer.IS_NOT_PROXY) {
        containers = containers.filter(function(cnt) {
            return  !cnt.isProxy();
        });
    }

    return containers;
};

module.exports = new ContainersHelper();