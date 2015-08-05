"use strict";

var App = require('../../app')
  , HttpProxyDriver = require('http-proxy')
  , HTTPDriver = require('http')
  , DNSDriver = require('node-named')
  , sinon = require('sinon')
  , DockerContainer = require('../../lib/docker-container')
  , ContainersFixtures = require('../fixtures/containers')

process.env.DOCKER_HOST = "tcp://127.0.0.1:2376"

var containers = [
  ContainersFixtures.container1.basic_info,
  ContainersFixtures.container2.basic_info,
  ContainersFixtures.container4.basic_info
]

exports.Dockerode = require('dockerode')
sinon.spy(exports, 'Dockerode')

sinon.stub(exports.Dockerode.prototype, "listContainers", function (filters, callback) {
  callback(null, containers)
})

var FakeContainer = ContainersFixtures.container1.basic_info

FakeContainer.inspect = function (callback) {
  if (typeof callback === 'function') {
    callback(null, ContainersFixtures.container1.data)
  }
}

sinon.stub(exports.Dockerode.prototype, "getContainer", function () {
  return FakeContainer
})

exports.HttpProxyDriver = HttpProxyDriver

sinon.stub(exports, 'HttpProxyDriver', function () {
  console.log("called with %j", arguments)
});

sinon.stub(DNSDriver, "createServer", function () {

  var proto = {
    on: function () {
      return this
    },
    send: function () {

    },
    listen: function () {

    }
  }
  sinon.spy(proto, 'on')
  sinon.spy(proto, 'send')
  sinon.spy(proto, 'listen')

  return proto
})

var app = new App(exports.HttpProxyDriver, HTTPDriver, DNSDriver, exports.Dockerode, 'docker', 9876, '127.0.0.1', '127.0.0.1', 9999)

exports.app = app;
exports.DNSDriver = DNSDriver;