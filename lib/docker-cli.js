"use strict";

var execSync = require('sync-exec')
  , Logger = require('./logger')
  , path = require('path')

/**
 * Docker CLI. Use boot2docker or docker-machine
 *
 * @constructor
 */
var DockerCLI = function () {

  this.executable = undefined

  if (this.execAsNormalUser('docker-machine').status === 0) {
    this.executable = 'docker-machine'
    this.HAS_DOCKER_MACHINE = true
  } else if(this.execAsNormalUser('boot2docker version').status === 0) {
    this.executable = 'boot2docker'
    this.HAS_BOOT2DOCKER = true
  }

}

DockerCLI.prototype.hasDockerExecutable = function () {
  return this.executable !== undefined
}

DockerCLI.prototype.isDockerVMRunning = function () {
  return this.getRunningVMName() !== null
}

DockerCLI.prototype.getRunningVMName = function () {

  if (this.runningVM !== undefined) {
    return this.runningVM
  }

  if (this.HAS_BOOT2DOCKER) {
    var config = this.getDockerConfig()
    this.runningVM = config.State === 'running' ? config.Name : null
    return this.runningVM
  }

  var result = this.execAsNormalUser("docker-machine active").stdout.trim()

  if (result !== '') {
    return (this.runningVM = result)
  }

  return false
}


DockerCLI.prototype.isDNSSetup = function(loopback_ip) {

  var dns_check

  if (this.HAS_BOOT2DOCKER || this.HAS_DOCKER_MACHINE) {
    var command_args = 'cat /var/lib/boot2docker/profile'
    if (this.HAS_DOCKER_MACHINE) {
      command_args = this.getRunningVMName() + ' ' + command_args
    }

    dns_check = this.proxyDockerCommand('ssh', command_args).stdout.trim()
    var is_setup = dns_check.indexOf('--dns ' + loopback_ip) !== -1
    return is_setup
  }

  return -1
}

DockerCLI.prototype.guessDockerSettings = function () {

  if (!this.HAS_BOOT2DOCKER && !this.HAS_DOCKER_MACHINE) {
    return false
  }

  var cfg

  if (!this.isDockerVMRunning()) {

    return -1

  } else if (this.HAS_BOOT2DOCKER) {

    cfg = this.getDockerConfig()
    process.env.DOCKER_HOST = 'tcp://' + this.getDockerIp() + ':2376'
    process.env.DOCKER_CERT_PATH = path.join(path.dirname(cfg.Iso), 'certs', 'boot2docker-vm')
    return true

  } else if (this.HAS_DOCKER_MACHINE) {

    cfg = this.getDockerConfig()
    process.env.DOCKER_HOST = cfg.H
    process.env.DOCKER_CERT_PATH = path.dirname(cfg.tlscert)
    return true
  }

  return false
}

DockerCLI.prototype.getDockerConfig = function() {

  var config = {}
  var result = this.proxyDockerCommand('config', this.getRunningVMName()).stdout.trim()

  if (this.HAS_BOOT2DOCKER) {
    try {
      config = JSON.parse(result)
      return config
    } catch (e) {
      return {Name: 'boot2docker-vm'}
    }

  } else if (this.HAS_DOCKER_MACHINE) {

      var evalArgument = function(arg) {
        var parts = arg.split('=')
        config[parts[0].replace(/\-/g, '')] = parts[1][0] === '"' ? parts[1].substr(1, parts[1].length - 1) : parts[1]
      }

      var regs = result.match(/--?([^= ]+)=([^ ]+)?/gi)
      if (regs) {
        regs.forEach(function(reg) {
          evalArgument(reg)
        })
      }
    return config
  }

  return null
}

/**
 *
 * @returns {String}
 */
DockerCLI.prototype.getDockerIp = function () {
  if (this.dockerIp) {
    return this.dockerIp
  }
  this.dockerIp = this.proxyDockerCommand('ip', this.getRunningVMName()).stdout.trim()
  return this.dockerIp
}

DockerCLI.prototype.proxyDockerCommand = function (command, args) {
  // machine -> boot2docker mapping
  if(this.HAS_BOOT2DOCKER) {
    switch (command) {
      case 'start':
        command = 'up'
        break
      case 'stop':
        command = 'down'
        break
      case 'restart':
        command = 'reset'
        break
      case 'env':
        command = 'shellinit'
        break
      case 'inspect':
        command = 'info'
        break
      case 'ls':
        command = 'status'
        break
      case 'config':
        command = 'info'
        break
      default:
        break;
    }
  }
  var fullCommand = this.executable + ' ' + command + ' ' + args
  Logger.debug('Executing: %s', fullCommand)
  return this.execAsNormalUser(fullCommand)
}

/**
 *
 * @param command
 * @returns {Object}
 */
DockerCLI.prototype.execAsNormalUser = function (command) {
  return execSync('sudo -u ' + process.env.SUDO_USER + ' ' + command)
}

module.exports = new DockerCLI()