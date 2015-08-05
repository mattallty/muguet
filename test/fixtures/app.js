"use strict";

var App = require('../../app')
  , HttpProxyDriver = require('http-proxy')
  , HTTPDriver = require('http')
  , DNSDriver = require('node-named')
  , sinon = require('sinon')

exports.HttpProxyDriver = HttpProxyDriver;

process.env.DOCKER_HOST = 'tcp://127.0.0.1:2376'

sinon.stub(exports, 'HttpProxyDriver', function() {
  console.log("called with %j", arguments)
});

sinon.stub(DNSDriver, "createServer", function () {

  var proto = {
    on : function () {
      return this
    },
    send : function() {

    },
    listen : function() {

    }
  }
  sinon.spy(proto, 'on')
  sinon.spy(proto, 'send')
  sinon.spy(proto, 'listen')

  return proto
})

var app = new App(exports.HttpProxyDriver, HTTPDriver, DNSDriver, 'docker', 9876, '127.0.0.1', '127.0.0.1', 9999)

exports.app = app;
exports.DNSDriver = DNSDriver;