"use strict";

var   named = require('node-named')
    , EventEmitter = require('events').EventEmitter
    , Logger = require('./logger')
    , util = require('util')
;

var DNSServer = function () {
    EventEmitter.call(this);
    this.server = named.createServer({name : "Muguet DNS Server"});
    this.server.on('query', this.emit.bind(this, 'query'));
};

util.inherits(DNSServer, EventEmitter);

DNSServer.prototype.listen = function(port) {
    port = port || 9999;
    this.server.listen(port, '::', function() {
        Logger.info('Muguet DNS Server listening on port %d', port);
    });
    return this;
};

exports.DNSServer = DNSServer;
