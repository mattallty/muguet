"use strict";

var should = require('should')
  , app = require('../../fixtures/app').app

describe('app', function () {


  before(function () {

  })

  describe('.getProxyIp', function() {
    it('should return 127.0.0.1', function() {
      should(app.getProxyIp()).equal('127.0.0.1')
    });
  })

  describe('.getDockerInfos', function() {
    it('should return an object with hostname and port', function() {
      should(app.getDockerInfos()).be.Object()
      should(app.getDockerInfos()).have.property('hostname', '127.0.0.1')
      should(app.getDockerInfos()).have.property('port', '2376')
    })
  })


  describe('.run', function() {
    it('should run', function() {
      app.run(false)
    })
  })


})