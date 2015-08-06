#!/usr/bin/env node

"use strict";

var VERSION = require('../package.json').version
  , Network = require('../lib/network')
  , request = require('request')
  , setup = require('../lib/check-config').setup
  , hasBoot2Docker = require('../lib/check-config').hasBoot2Docker
  , routePaquets = require('../lib/check-config').routePaquets
  , DockerDriver = require('dockerode')
  , parseArgs = require('minimist')
  , defaults = require('defaults')
  , HTTPDriver = require('http')
  , HttpProxyDriver = require('http-proxy')
  , DNSDriver = require('node-named')
  , Logger = require('../lib/logger')
  , App = require('../app')


require('colors');


var Cli = exports.Cli = function (argv) {
  this.argv = parseArgs(argv.slice(2))
  this.options = defaults(this.argv, {
    'domain': 'docker',
    'api-port': 9876,
    'proxy-ip': '10.254.254.254',
    'loopback-ip': '10.254.254.254',
    'dns-ip': '127.0.0.1',
    'dns-port': 53
  })
}

Cli.prototype.run = function () {

  if (this.argv.help || this.argv.h || this.argv._.length === 0 || ['setup', 'up'].indexOf(this.argv._[0]) === -1) {
    return this.help()
  }

  if (!process.env.DOCKER_HOST) {
    return Logger.error("Please set the DOCKER_HOST environment variable before running Muguet.\n");
  }

  if (process.env.USER !== 'root') {
    return Logger.error("This program must be run as root.\n");
  }

  if (this.argv._[0] === 'setup') {
    return setup(this.options['loopback-ip'])
  }

  if (this.argv._[0] === 'up') {

    var app = new App(
      HttpProxyDriver,
      HTTPDriver,
      DNSDriver,
      DockerDriver,
      this.options.domain,
      this.options['api-port'],
      this.options['proxy-ip'],
      this.options['dns-ip'],
      this.options['dns-port']
    )

    // check version
    request('https://raw.githubusercontent.com/mattallty/muguet/master/package.json', function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var lastVersion = JSON.parse(body).version
        if (app.version !== lastVersion) {
          Logger.warn(
            String('Your muguet version (' + app.version + ') is not up to date (latest version is ' + lastVersion + ')').black.bgYellow
          )
          Logger.warn(
            String('Consider upgrading using: (sudo) npm install -g muguet').black.bgYellow
          )
        }
      }
    })

    Network.setupResolver(this.options.domain, this.options['dns-port'], this.options['dns-ip'])

    if (hasBoot2Docker()) {
      routePaquets()
    }

    app.run()
  }
}

Cli.prototype.help = function () {

  var helpStr = [
    '',
    (' Muguet ' + VERSION).green,
    '',
    '  Usage:',
    '',
    '     ' + ('sudo -E bash -c \'muguet') + ' ' + ('<command>').magenta + ' ' + ('[options]').yellow + '\'',
    '',
    '  Commands:',
    '',
    '     ' + ('setup').magenta + '      setup your environment',
    '     ' + ('up').magenta + '         start Muguet',
    '',
    '  Options:',
    '',
    '     ' + ('-h | --help').yellow + '                      Display help',
    '     ' + ('--domain[=docker]').yellow + '                Set your domain. (set the /etc/resolver/{domain} accordingly)',
    '     ' + ('--proxy-ip[=10.254.254.254]').yellow + '      IP of the proxy server. Specify it when not in a local environment.',
    '     ' + ('--loopback-ip[=10.254.254.254]').yellow + '   Loppback IP. Used for local development.',
    '     ' + ('--api-port[=9876]').yellow + '                Set the REST API port',
    '     ' + ('--dns-ip[=127.0.0.1]').yellow + '             IP of the DNS server',
    '     ' + ('--dns-port[=9999]').yellow + '                Set the DNS server port',
    ''
  ].join("\n")

  console.log(helpStr)
}

if (require.main === module) {
  new Cli(process.argv).run()
}
