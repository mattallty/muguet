"use strict";

var fs = require('fs')
  , url = require('url')
  , path = require('path')
  , DockerContainer = require('./docker-container')
  , ContainersHelper = require('./containers-helper')

var Promise = typeof Promise === 'undefined' ?
  require('promise/lib/es6-extensions') :
  Promise

/**
 * Docker API
 *
 * @constructor
 */
var DockerAPI = function (app, docker_driver) {
  this.app = app
  this.dockerDriver = docker_driver
}

/**
 * Return the underlying Dockerode instance
 *
 * @returns {Object}
 */
DockerAPI.prototype.getDockerodeInstance = function () {

  if (this.instance === undefined) {

    // Workaround for certs
    // see https://github.com/apocas/dockerode/issues/154
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

    var getCertPathFile = function (file) {
      return process.env.CI ? null : fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, file))
    };

    this.instance = new (this.dockerDriver)({
      protocol: 'https',
      host: this.app.getDockerInfos().hostname,
      port: this.app.getDockerInfos().port,
      ca: getCertPathFile('ca.pem'),
      cert: getCertPathFile('cert.pem'),
      key: getCertPathFile('key.pem'),
      timeout: 3000
    })
  }

  return this.instance
}

/**
 * Get container infos
 *
 * @param {Object} container
 * @returns {Promise}
 * @private
 */
DockerAPI.prototype._getContainerObject = function (container) {
  return new Promise(function (resolve, reject) {
    this.getDockerodeInstance()
      .getContainer(container.Id)
      .inspect(function (err, data) {
        if (err) {
          return reject(err)
        }
        resolve(new DockerContainer(this.app, container, data))
      }.bind(this))
  }.bind(this))
}

/**
 * List containers
 *
 * @param {Number} bitflags
 * @returns {Promise}
 */
DockerAPI.prototype.listContainers = function (bitflags) {

  var self = this

  return new Promise(function (resolve, reject) {

    self.getDockerodeInstance().listContainers({all: false}, function (err, containers) {

      if (err) {
        return reject(err)
      }

      var promises = containers.map(function (cnt) {
        return self._getContainerObject(cnt)
      })

      Promise.all(promises).then(function (cnts) {
        cnts = ContainersHelper.filterContainers(cnts, bitflags)
        resolve(cnts)
      }).catch(function (err2) {
        reject(err2)
      })
    })
  })
}

module.exports = DockerAPI
