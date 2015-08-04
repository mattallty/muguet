"use strict";

var should = require('should')
  , sinon = require('sinon')
  , App = require('../../../app')
  , HttpProxyDriver = require('http-proxy')
  , dockerode = require('dockerode')
  , DockerAPI = require('../../../lib/docker-api')
  , ContainersFixtures = require('../../fixtures/containers')
  , DockerContainer = require('../../../lib/docker-container')

require('should-promised');

describe('docker-api', function () {

  var api;
  var containers = [
    ContainersFixtures.container1.basic_info,
    ContainersFixtures.container2.basic_info,
    ContainersFixtures.container4.basic_info
  ];

  var app;

  before(function () {
    process.env.DOCKER_HOST = 'tcp://192.168.59.103:2376'
    app = new App(HttpProxyDriver, 'docker', 9876, '127.0.0.1', '127.0.0.1', 9999);
  })

  it('should return a DockerAPI instance', function () {

    exports.Dockerode = dockerode;

    sinon.spy(exports, 'Dockerode');

    sinon.stub(exports.Dockerode.prototype, "listContainers", function (filters, callback) {
      callback(null, containers);
    });

    sinon.stub(exports.Dockerode.prototype, "getContainer", function (container) {

      var obj = ContainersFixtures.container1.basic_info;

      should(container).not.be.empty();

      obj.inspect = function (callback) {
        return callback(null, ContainersFixtures.container1.data);
      };

      return obj;
    });

    api = new DockerAPI(app, exports.Dockerode);
    should(api).be.instanceOf(DockerAPI);

  });

  describe(".listContainers()", function () {


    it('should return a Promise and then() should return DockerContainer[]', function (done) {

      var promise;
      promise = api.listContainers();
      promise.should.be.Promise();

      promise
        .then(function (cnts) {
          should(cnts).be.Array().and.matchEach(function (value) {
            should(value).be.instanceOf(DockerContainer);
          });
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });


  });
});