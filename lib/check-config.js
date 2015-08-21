"use strict";

var execSync = require('sync-exec')
  , Logger = require('./logger')

require('colors')


/**
 *
 * @param {DockerCLI} dockerCli
 */
var routePaquets = exports.routePaquets = function (dockerCli) {

  if (false === dockerCli.isDockerVMRunning()) {
    Logger.error('Please start boot2docker/docker-machine first ( "boot2docker up" or "docker-machine start default")')
    return false
  }

  var routeExec = execSync('route -n add 172.17.0.0/16 ' + dockerCli.getDockerIp())

  if (routeExec.status !== 0) {
    Logger.error("Cannot add route to docker VM")
    Logger.error(routeExec.stderr)
    return false
  }

  return true
}


exports.setup = function (loopback_ip, dockerCli) {

  var hasDockerExecutable = dockerCli.hasDockerExecutable()

  if (hasDockerExecutable) {

    Logger.info((dockerCli.HAS_BOOT2DOCKER ? 'boot2docker' : 'docker-machine') + ' detected')

    if (!dockerCli.isDockerVMRunning()) {
      Logger.error('Docker VM is not started.');
      Logger.error('Please start it using:');

      if (dockerCli.HAS_BOOT2DOCKER) {
        Logger.error('    boot2docker up\n'.yellow);
      } else {
        Logger.error('    boot2docker start default (or whatever VM name other than "default")\n'.yellow);
      }

      return false
    }

    // add loopback URL
    var loopbackExec = execSync('ifconfig lo0 alias ' + loopback_ip)
    if (loopbackExec.status !== 0) {
      Logger.error('Error while setting up loopback IP');
      Logger.error(loopbackExec.stderr);
      return false
    }

    // route paquets
    routePaquets(dockerCli)

    // if DNS is already setup, returns
    if (dockerCli.isDNSSetup(loopback_ip) === true) {
      return true
    }

    Logger.info("Updating Docker DNS");

    var updateDNSCommand =  '\'sudo touch /var/lib/boot2docker/profile && ' +
                            'echo EXTRA_ARGS=\\"\\$EXTRA_ARGS --dns ' + loopback_ip + ' --dns 8.8.8.8\\" ' +
                            ' | sudo tee -a /var/lib/boot2docker/profile\''

    if(dockerCli.HAS_DOCKER_MACHINE) {
      updateDNSCommand = dockerCli.getRunningVMName() + ' ' + updateDNSCommand
    }

    var updateDNSStatus = dockerCli.proxyDockerCommand('ssh', updateDNSCommand);

    if (updateDNSStatus.status !== 0) {
      return Logger.warn("Error while updating Docker DNS: " + updateDNSStatus.stderr)
    }

    Logger.info("boot2docker DNS updated")
    Logger.info("Restarting Docker VM... please wait...");

    var restartStatus = dockerCli.proxyDockerCommand('restart', dockerCli.getRunningVMName())

    if (restartStatus.status === 0) {
      Logger.info("Docker VM restarted");
    } else {
      Logger.warn('Docker VM may have failed restarting. Try to restart it manualy ' +
        '("boot2docker reset" or "docker-machine restart default")')
    }
  }
}