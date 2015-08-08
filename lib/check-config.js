"use strict";

var execSync = require('sync-exec')
  , Logger = require('./logger')


/**
 *
 * @param command
 * @returns {Object}
 */
var execAsNormalUser = function (command) {
  return execSync('sudo -u ' + process.env.SUDO_USER + ' ' + command)
}

/**
 *
 * @returns {String}
 */
var getBoot2DockerIP = function () {
  return execAsNormalUser('boot2docker ip').stdout.trim()
}


/**
 *
 * @returns {boolean}
 */
var hasBoot2Docker = exports.hasBoot2Docker = function () {
  return execAsNormalUser('boot2docker version').status === 0
}

/**
 *
 * @returns {boolean}
 */
var isBoot2DockerRunning = exports.isBoot2DockerRunning = function () {
  var b2dStatus = execAsNormalUser('boot2docker status')
  var b2dStatusStr = b2dStatus.stdout.trim()
  return b2dStatusStr === 'running'
}

var routePaquets = exports.routePaquets = function () {

  if (isBoot2DockerRunning() === false) {
    Logger.error('Please start boot2docker first (boot2docker up)')
    return false
  }

  var boot2dockerIp = getBoot2DockerIP()
  var routeExec = execSync('route -n add 172.17.0.0/16 ' + boot2dockerIp)

  if (routeExec.status !== 0) {
    Logger.error("Cannot add route to boot2docker")
    Logger.error(routeExec.stderr)
    return false
  }

  return true
}




exports.setup = function (loopback_ip) {

  var hasBoot = hasBoot2Docker()

  if (hasBoot) {

    Logger.info('Boot2docker detected')

    if (!isBoot2DockerRunning()) {
      Logger.error('Boot2docker VM is not started.');
      Logger.error('Please start it using:');
      Logger.error('    boot2docker up\n');
      return false
    }

    // ad loopback URL
    var loopbackExec = execSync('ifconfig lo0 alias ' + loopback_ip)
    if (loopbackExec.status !== 0) {
      Logger.error('Error while setting up loopback IP');
      Logger.error(loopbackExec.stderr);
      return false
    }

    // route paquets
    routePaquets()

    Logger.info("Updating boot2docker DNS");

    var updateDNSStatus = execAsNormalUser('boot2docker ssh -t \'sudo touch /var/lib/boot2docker/profile && echo EXTRA_ARGS=\\"--dns ' + loopback_ip + ' --dns 8.8.8.8\\" | sudo tee /var/lib/boot2docker/profile\'');

    if (updateDNSStatus.status !== 0) {
      return Logger.error("Error while updating boot2docker DNS")
    }

    if (updateDNSStatus.stdout.trim() === 'EXTRA_ARGS="--dns ' + loopback_ip + ' --dns 8.8.8.8"') {
      Logger.info("boot2docker DNS updated")
    } else {
      Logger.error("boot2docker DNS has not been updated.")
      Logger.error("stdout: " + updateDNSStatus.stdout.trim())
      Logger.error("stderr: " + updateDNSStatus.stderr.trim())
      return false
    }

    Logger.info("Restarting boot2docker VM... please wait...");

    var restartStatus = execAsNormalUser('boot2docker restart')

    if (restartStatus.status === 0) {
      Logger.info("boot2docker VM restarted");
    } else {
      Logger.warn('boot2docker VM may have failed restarting. Try to restart it manualy (boot2docker restart)')
    }
  }
}