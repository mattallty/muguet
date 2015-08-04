"use strict";

var should = require('should')
  , app = require('../../fixtures/app').app
  , DockerContainer = require('../../../lib/docker-container')
  , ContainersFixtures = require('../../fixtures/containers')
  ;

describe('docker-container', function () {

  var container1
  var container2
  var container3
  var container4

  before(function () {
    process.env.DOCKER_HOST = 'tcp://192.168.59.103:2376'
  })

  describe("new DockerContainer()", function () {

    it('should return a DockerContainer instance', function () {

      container1 = new DockerContainer(
        app,
        ContainersFixtures.container1.basic_info,
        ContainersFixtures.container1.data
      )
      should(container1).be.instanceOf(DockerContainer)

      container2 = new DockerContainer(
        app,
        ContainersFixtures.container2.basic_info,
        ContainersFixtures.container2.data
      )
      should(container2).be.instanceOf(DockerContainer)

      container3 = new DockerContainer(
        app,
        ContainersFixtures.container3.basic_info,
        ContainersFixtures.container3.data
      )
      should(container3).be.instanceOf(DockerContainer)

      container4 = new DockerContainer(
        app,
        ContainersFixtures.container4.basic_info,
        ContainersFixtures.container4.data
      )
      should(container4).be.instanceOf(DockerContainer)
    });
  });

  describe(".getRawData()", function () {
    it('should return a data passed in the constructor', function () {
      should(container1.getRawData()).equal(ContainersFixtures.container1.data);
    });
  });

  describe(".getBasicInfo()", function () {
    it('should return a basic_info passed in the constructor', function () {
      should(container1.getBasicInfo()).equal(ContainersFixtures.container1.basic_info);
    });
  });

  describe(".getSubDomain()", function () {
    it('should return the right sub-domain', function () {
      container1.getSubDomain().should.equal(
        ContainersFixtures.container1.basic_info.Labels['com.docker.compose.service']
      )
      container2.getSubDomain().should.equal(
        ContainersFixtures.container2.basic_info.Id.substr(0, 12)
      )
      container3.getSubDomain().should.equal(
        ContainersFixtures.container3.data.Config.Hostname
      )
    })
  })


  describe(".getSubDomainMap()", function () {
    it('should return a sub-domain map', function () {
      var expected = {'80': 'foo', '8888': 'bar', '9999': 'foo-bar'};
      should(container4.getSubDomainMap()).be.Object().and.containEql(expected);
    });
  });

  describe(".getPortsRestriction()", function () {
    it('should return the restricted list of ports to map', function () {
      should(container4.getPortsRestrictions()).be.Array()
        .and.containEql(80)
        .and.containEql(9999);
    });
  });

  describe(".getId()", function () {
    it('should return the container id', function () {
      should(container4.getId()).equal(ContainersFixtures.container4.basic_info.Id);
    });
  });

  describe(".getImage()", function () {
    it('should return the container image name', function () {
      should(container4.getImage()).equal(ContainersFixtures.container4.basic_info.Image);
    });
  });

  describe(".getCreatedDate()", function () {
    it('should return the container created date', function () {
      should(container4.getCreatedDate()).equal('2015-07-29T13:39:45.000Z');
    });
  });

  describe(".isRunning()", function () {
    it('should return true on container1', function () {
      should(container1.isRunning()).be.True();
    });
    it('should return false on container2', function () {
      should(container2.isRunning()).be.False();
    });
  });

  describe(".shouldBeProxified()", function () {
    it('should return true on container1', function () {
      should(container1.shouldBeProxified()).be.True();
    });
    it('should return false on container2', function () {
      should(container2.shouldBeProxified()).be.False();
    });
  });

  describe(".getIPAddress()", function () {
    it('should return the IP address', function () {
      container1.getIPAddress().should.equal(
        ContainersFixtures.container1.data.NetworkSettings.IPAddress
      );
    });
  });

  describe(".getHostname()", function () {
    it('should return the hostname', function () {
      container1.getHostname().should.equal(
        ContainersFixtures.container1.data.Config.Hostname
      );
    });
  });

  describe(".getPorts()", function () {
    it('should return the ports', function () {
      container1.getPorts().should.be.Array().and.matchEach(function (ports_spec) {
        ports_spec.should.have.keys(['IP', 'PrivatePort', 'PublicPort', 'Type']);
      })
    });
  });

  describe(".getWebPort()", function () {
    it('should return null for container 1', function () {
      should(container1.getWebPort()).be.Null();
    });
    it('should return null for container 2', function () {
      should(container2.getWebPort()).be.Number().and.equal(8888);
    });
  });

  describe(".getComposeService()", function () {
    it('should return the compose service for containe1', function () {
      container1.getComposeService().should.equal(
        ContainersFixtures.container1.basic_info.Labels['com.docker.compose.service']
      );
    });
  });

  describe(".getComposeContainerNumber()", function () {
    it('should return the compose container number for containe1', function () {
      container1.getComposeContainerNumber().should.equal(
        parseInt(ContainersFixtures.container1.basic_info.Labels['com.docker.compose.container-number'])
      );
    });
  });


});