"use strict";

var should = require('should')
  , app = require('../../fixtures/app').app
  , dns = require('dns')

var Promise = typeof Promise === 'undefined' ?
  require('promise/lib/es6-extensions') :
  Promise


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
    it('should run', function(done) {

      app.run(true)

      dns.setServers(['127.0.0.1'])

      var checkDns1 = function() {
        return new Promise(function(resolve, reject) {
          dns.resolve('bidder.docker-test', 'A', function (err, addresses) {
            if (err) {
              return reject(err)
            }
            resolve(addresses)
          });
        });
      }

      var checkDns2 = function() {
        return new Promise(function(resolve, reject) {
          dns.resolve('foo-bar.6bbc6ec863f0.docker-test', 'A', function (err, addresses) {
            if (err) {
              return reject(err)
            }
            resolve(addresses)
          });
        });
      }

      setTimeout(function () {

        console.log(app.dnsServer.getEntries())
        app.dnsServer.getEntries().should.be.Object().and.containEql({
          '6bbc6ec863f0.docker-test': '172.17.0.31',
          'bar.6bbc6ec863f0.docker-test': '127.0.0.1',
          'bidder.docker-test': '127.0.0.1',
          'foo-bar.6bbc6ec863f0.docker-test': '127.0.0.1',
          'foo.6bbc6ec863f0.docker-test': '127.0.0.1',
          'muguet.docker-test': '127.0.0.1'
        })

        app.dnsServer.getPort().should.equal(53)

        // test DNS
        Promise.all([checkDns1(), checkDns2()]).then(function(addrs) {
          console.log(addrs)
          addrs.should.be.Array().with.length(2);
          addrs[0][0].should.be.equal('127.0.0.1')
          addrs[1][0].should.be.equal('127.0.0.1')
          app.dnsServer.close()
          done()
        }).catch(function(err) {
          done(err)
        })
      }, 1000)
    })
  })


})