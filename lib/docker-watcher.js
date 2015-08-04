"use strict";

var DockerAPI = require('./docker-api')
  , util = require('util')
  , _ = require('lodash')
  , EventEmitter = require('events').EventEmitter


/**
 * Watcher for docker containers changes
 *
 * @param {App} app
 * @param {Number} flags
 * @param {Number} interval
 * @constructor
 */
var DockerWatcher = function (app, docker_driver, flags, interval) {
  EventEmitter.call(this)
  this.app = app
  this.dockerAPI = new DockerAPI(this.app, docker_driver)
  this.containers = []
  this.interval = interval || 200
  this.flags = flags || null
}

util.inherits(DockerWatcher, EventEmitter)

/**
 * Callback for containers list
 *
 * @param {Array} list
 * @private
 */
DockerWatcher.prototype._onContainersListReceived = function (list) {
  var diff = true
  if (this.containers.length) {
    diff = false
    list.forEach(function (cnt, id) {
      diff = (_.isEqual(list[id].getComparableInfos(), this.containers[id].getComparableInfos()) === false)
    }.bind(this));
  }
  if (diff) {
    this.emit(_.isEmpty(this.containers) ? 'setup' : 'change', list)
  }
  this.containers = list
  setTimeout(this._doWatch.bind(this), this.interval)
}

/**
 * Callback for containers list error
 *
 * @param {string} err
 * @private
 */
DockerWatcher.prototype._onContainersListError = function (err) {
  this.emit('error', err)
  setTimeout(this._doWatch.bind(this), 5000)
}

/**
 * Watch for containers changes
 *
 * @private
 */
DockerWatcher.prototype._doWatch = function () {
  this.dockerAPI.listContainers(this.flags)
    .then(this._onContainersListReceived.bind(this))
    .catch(this._onContainersListError.bind(this))
}

/**
 * Run
 */
DockerWatcher.prototype.run = function () {
  this._doWatch()
  return this
}

module.exports = DockerWatcher