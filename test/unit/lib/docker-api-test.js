"use strict";

var should = require('should')
  , app = require('../../fixtures/app').app
  , DockerAPI = require('../../../lib/docker-api')
  , DockerContainer = require('../../../lib/docker-container')

require('should-promised');

describe('docker-api', function () {

  var api

  it('should return a DockerAPI instance', function () {
    api = new DockerAPI(app)
    should(api).be.instanceOf(DockerAPI)
  })

  describe(".listContainers()", function () {

    it('should return a Promise and then() should return DockerContainer[]', function (done) {

      var promise

      promise = api.listContainers()
      promise.should.be.Promise()

      promise
        .then(function (cnts) {
          should(cnts).be.Array().and.matchEach(function (value) {
            should(value).be.instanceOf(DockerContainer)
          })
          done()
        })
        .catch(function (err) {
          done(err)
        })
    })
  })
})