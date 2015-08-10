"use strict";

var execSync = require('sync-exec')
  , Logger = require('./logger')
  , path = require('path')

var B2D_EXISTS = null
var B2D_IP = null

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
  if (B2D_IP !== null) {
    return B2D_IP
  }
  B2D_IP = execAsNormalUser('boot2docker ip').stdout.trim()
  return B2D_IP
}


/**
 *
 * @returns {boolean}
 */
var hasBoot2Docker = exports.hasBoot2Docker = function () {
  if (B2D_EXISTS !== null) {
    return B2D_EXISTS
  }
  B2D_EXISTS = execAsNormalUser('boot2docker version').status === 0
  return B2D_EXISTS
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

exports.guessDockerSettings = function () {
  if (hasBoot2Docker() && !isBoot2DockerRunning()) {

    return -1

  } else if(hasBoot2Docker()) {

    var cfg = execAsNormalUser('boot2docker config')
    var b2d_dir = null

    cfg.stdout.split("\n").some(function (line) {
      if (line.substr(0, 5) === 'Dir =') {
        b2d_dir = line.substr(7, line.length - 8)
        return true
      }
    })

    process.env.DOCKER_HOST = 'tcp://' + getBoot2DockerIP() + ':2376'
    process.env.DOCKER_CERT_PATH = path.join(b2d_dir, 'certs', 'boot2docker-vm')
    return true
  }

  return false
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

    // if boot2docker DNS is already setup, returns
    var dns_check = execAsNormalUser('boot2docker ssh -t \'cat /var/lib/boot2docker/profile\'')
    if (dns_check.stdout.trim() === 'EXTRA_ARGS="--dns ' + loopback_ip + ' --dns 8.8.8.8"') {
      return true
    }

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