"use strict";

var should = require('should')
  , DockerContainer = require('../../../lib/docker-container')
  , app = require('../../fixtures/app').app
  , ContainersHelper = require('../../../lib/containers-helper')
  , ContainersFixtures = require('../../fixtures/containers')

describe('container-helper', function () {

  var containers

  before(function () {
    containers = [
      new DockerContainer(app, ContainersFixtures.container1.basic_info, ContainersFixtures.container1.data),
      new DockerContainer(app, ContainersFixtures.container2.basic_info, ContainersFixtures.container2.data),
      new DockerContainer(app, ContainersFixtures.container3.basic_info, ContainersFixtures.container3.data),
      new DockerContainer(app, ContainersFixtures.container4.basic_info, ContainersFixtures.container4.data)
    ]
  })

  describe(".filterContainers(containers, DockerContainer.IS_RUNNING)", function () {
    it('should return an  array with 2 DockerContainer instances', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_RUNNING);
      should(result).be.length(3);
    });
  });

  describe(".filterContainers(containers, DockerContainer.IS_STOPPED)", function () {
    it('should return an  array with 1 DockerContainer instance', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_STOPPED);
      should(result).be.length(1);
    });
  });

  describe(".filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED)", function () {
    it('should return an  array with 3 DockerContainer instance', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED);
      should(result).be.length(3);
    });
  });

  describe(".filterContainers(containers, DockerContainer.HAS_EXPOSED_PORTS)", function () {
    it('should return an  array with 2 DockerContainer instances', function () {
      var result = ContainersHelper.filterContainers(containers, DockerContainer.HAS_EXPOSED_PORTS);
      should(result).be.length(3);
    });
  });



});