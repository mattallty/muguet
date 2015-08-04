"use strict";

var DockerContainer = require('./docker-container')

var ContainersHelper = function () {

}

/**
 * Filter containers retrieving only running, enabled and skipping proxy
 *
 * @param {DockerContainer[]} containers
 * @returns {Array}
 * @private
 */
ContainersHelper.prototype.filterContainers = function (containers, flags) {

  if (flags === null || flags === undefined) {
    return containers
  }

  if (flags & DockerContainer.HAS_PROXY_ENABLED) {
    containers = containers.filter(function (cnt) {
      return cnt.shouldBeProxified()
    })
  }

  if (flags & DockerContainer.IS_RUNNING) {
    containers = containers.filter(function (cnt) {
      return cnt.isRunning()
    })
  }

  if (flags & DockerContainer.IS_STOPPED) {
    containers = containers.filter(function (cnt) {
      return !cnt.isRunning()
    })
  }

  if (flags & DockerContainer.HAS_EXPOSED_PORTS) {
    containers = containers.filter(function (cnt) {
      return cnt.getPorts().length > 0
    })
  }

  return containers
}

module.exports = new ContainersHelper()