#!/usr/bin/env node

"use strict";

var VERSION = require('../package.json').version

/*

 -h | --help            Display help
 --domain[=docker]      Set your domain. (set the /etc/resolver/{domain} accordingly)
 --api-port[=9876]      Set the REST API port
 --proxy-ip[=127.0.0.1] IP of the proxy server. Specify it when not in a local environment.
 --dns-ip[=127.0.0.1]   IP of the DNS server
 --dns-port[=9999]      Set the DNS server port
 */

var parseArgs = require('minimist')
  , defaults = require('defaults')
  , HTTPDriver = require('http')
  , HttpProxyDriver = require('http-proxy')
  , DNSDriver = require('node-named')
  , Logger = require('../lib/logger')
  , App = require('../app')


var Cli = exports.Cli = function (argv) {
  this.argv = parseArgs(argv.slice(2))
  this.options = defaults(this.argv, {
    'domain': 'docker',
    'api-port': 9876,
    'proxy-ip': '127.0.0.1',
    'dns-ip': '127.0.0.1',
    'dns-port': 9999
  })
}

Cli.prototype.run = function () {

  if (this.argv.help || this.argv.h) {
    return this.help()
  }

  if (process.env.USER !== 'root') {
    return Logger.error("This program must be run as root.\n");
  }

  var app = new App(
    HttpProxyDriver,
    HTTPDriver,
    DNSDriver,
    this.options.domain,
    this.options['api-port'],
    this.options['proxy-ip'],
    this.options['dns-ip'],
    this.options['dns-port']
  )

  app.run()
}

Cli.prototype.help = function () {

  var helpStr = [
    '',
    ' Muguet ' + VERSION,
    '',
    '   -h | --help            Display help',
    '   --domain[=docker]      Set your domain. (set the /etc/resolver/{domain} accordingly)',
    '   --proxy-ip[=127.0.0.1] IP of the proxy server. Specify it when not in a local environment.',
    '   --api-port[=9876]      Set the REST API port',
    '   --dns-ip[=127.0.0.1]   IP of the DNS server',
    '   --dns-port[=9999]      Set the DNS server port',
    ''
  ].join("\n")

  console.log(helpStr)
}

if (require.main === module) {
  new Cli(process.argv).run()
}
