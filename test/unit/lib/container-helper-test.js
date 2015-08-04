"use strict";

var should = require('should')
  , App = require('../../../app')
  , DockerContainer = require('../../../lib/docker-container')
  , HttpProxyDriver = require('http-proxy')
  , HTTPDriver = require('http')
  , DNSDriver = require('node-named')
  , ContainersHelper = require('../../../lib/containers-helper')
  , ContainersFixtures = require('../../fixtures/containers')

describe('container-helper', function () {

  var app, containers

  before(function () {
    process.env.DOCKER_HOST = 'tcp://192.168.59.103:2376'
    app = new App(HttpProxyDriver, DNSDriver, 'docker', 9876, '127.0.0.1', '127.0.0.1', 9999);
    containers = [
      new DockerContainer(app, ContainersFixtures.container1.basic_info, ContainersFixtures.container1.data),
      new DockerContainer(app, ContainersFixtures.container2.basic_info, ContainersFixtures.container2.data),
      new DockerContainer(app, ContainersFixtures.container4.basic_info, ContainersFixtures.container4.data)
    ]
  })

  describe(".filterContainers(containers, DockerContainer.IS_RUNNING)", function () {
    it('should return an  array with 2 DockerContainer instances', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_RUNNING);
      should(result).be.length(2);
    });
  });

  describe(".filterContainers(containers, DockerContainer.IS_STOPPED)", function () {
    it('should return an  array with 1 DockerContainer instance', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_STOPPED);
      should(result).be.length(1);
    });
  });

  describe(".filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED)", function () {
    it('should return an  array with 1 DockerContainer instance', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED);
      should(result).be.length(2);
    });
  });

});