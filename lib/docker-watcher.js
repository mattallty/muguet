"use strict";

var   DockerAPI = require('./docker-api')
    , DockerContainer = require('./docker-container')
    , util = require('util')
    , _ = require('lodash')
    , EventEmitter = require('events').EventEmitter;

/**
 * Watcher for docker containers changes
 *
 * @param {Number} flags
 * @param {Number} interval
 * @constructor
 */
var DockerWatcher = function(docker_driver, flags, interval) {
    EventEmitter.call(this);
    this._dockerAPI = new DockerAPI(docker_driver);
    this._connected = false;
    this._containers = {};
    this._interval = interval || 200;
    this._flags = flags || DockerContainer.HAS_PROXY_ENABLED | DockerContainer.IS_RUNNING;
};

util.inherits(DockerWatcher, EventEmitter);

/**
 * Callback for containers list
 *
 * @param {Array} list
 * @private
 */
DockerWatcher.prototype._onContainersListReceived = function(list) {
    this._connected = true;
    if (_.isEqual(list, this._containers) === false) {
        this.emit(_.isEmpty(this._containers) ? 'setup' : 'change', list);
    }
    this._containers = list;
    setTimeout(this._doWatch.bind(this), this._interval);
};

/**
 * Callback for containers list error
 *
 * @param {string} err
 * @private
 */
DockerWatcher.prototype._onContainersListError = function(err) {
    this.emit('error', err);
    setTimeout(this._doWatch.bind(this), 5000);
};

/**
 * Watch for containers changes
 *
 * @private
 */
DockerWatcher.prototype._doWatch = function () {
    this._dockerAPI.listContainers(this._flags)
        .then(this._onContainersListReceived.bind(this))
        .catch(this._onContainersListError.bind(this));
};

/**
 * Run
 */
DockerWatcher.prototype.run = function () {
    this._doWatch();
    return this;
};

module.exports = DockerWatcher;