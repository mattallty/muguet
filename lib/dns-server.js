"use strict";

var   named = require('node-named')
    , EventEmitter = require('events').EventEmitter
    , Logger = require('./logger')
    , fs = require('fs-extra')
    , path = require('path')
    , util = require('util')
;

var DNSServer = function (domain) {
    EventEmitter.call(this);
    this.domain = domain;
    this.server = named.createServer({name : "Muguet DNS Server"});
    this.server.on('query', this.emit.bind(this, 'query'));
};

util.inherits(DNSServer, EventEmitter);

/**
 * Setup the /etc/resolver/{domain} file
 * @private
 */
DNSServer.prototype._setupResolver = function(port, ip) {
    var file = path.join('/etc/resolver', this.domain);

    var contents = [
        "nameserver " + ip,
        "port " + port
    ].join("\n");

    fs.outputFile(file, contents, function() {
        Logger.debug('Resolver file %s updated', file);
    });

    return this;
};

DNSServer.prototype.listen = function(port, ip) {
    port = port || 9999;
    this._setupResolver(port, ip);

    this.server.listen(port, '::', function() {
        Logger.info('Muguet DNS Server listening on port %d', port);
    });

    return this;
};

exports.DNSServer = DNSServer;
