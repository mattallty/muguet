#!/usr/bin/env node
/*
    This script updates you /etc/hosts file to point your containers sub-domains to the proxy.

    WARNING:
        - This script MUST be run in root, or with sudo.
        - If run with sudo, use the following to make necessary env vars accessible:

            sudo -E bash -c 'node bin/etc-hosts-updater.js'


    NOTE: The following environment variables must be set:
        - DOCKER_HOST: The Docker Host, for example tcp://192.168.59.103:2376
        - DOCKER_CERT_PATH: Path to the docker certs directory

    Usage:
        ./etc-hosts-updater [options]

    Options:

        -b [--background]   Make the script run in background
*/

"use strict";

var   fs = require('fs')
    , _ = require('lodash')
    , request = require('request')
    , flags = require('../lib/docker').flags
    , DockerWatcher = require('../lib/docker-watcher')
;

var help =  [
'',
'   Etc-Hosts Updater v1.0',
'',
'   This script updates you /etc/hosts file to point your containers sub-domains to the proxy.',
'',
'    WARNING:',
'       - This script MUST be run in root, or with sudo.',
'       - If run with sudo, use the following to make necessary env vars accessible:',
'',
'           sudo -E bash -c \'node bin/etc-hosts-updater.js\'',
'',
'   NOTE: The following environment variables must be set:',
'       - DOCKER_HOST: The Docker Host, for example tcp://192.168.59.103:2376',
'       - DOCKER_CERT_PATH: Path to the docker certs directory',
'',
'   Usage:',
'',
'       ./etc-hosts-updater [options]',
'',
'   Options:',
'',
'       -b [--background]   Make the script run in background',
'       -h [--help]         Display this help',
'',
''].join("\n");

var ON_BACKGROUND = process.argv.indexOf('-b') >= 0 || process.argv.indexOf('--background') >= 0;
var ON_HELP = process.argv.indexOf('-h') >= 0 || process.argv.indexOf('--help') >= 0;

if (ON_HELP) {
    console.log(help);
    process.exit(0);
}

if (!process.env.DOCKER_HOST || !process.env.DOCKER_CERT_PATH) {
    console.error("Error: Environment variables DOCKER_HOST and DOCKER_CERT_PATH must be set.");
    process.exit(1);
}

if (process.env.USER !== 'root') {
    console.error("Error: This program must be run by the 'root' user!");
    process.exit(1);
}

var HostUpdater = function () {
    this._proxy = false;
};

HostUpdater.prototype.run = function () {
    var watcher = new DockerWatcher(flags.IS_RUNNING).run();
    watcher
        .on('setup', this._onContainerSetup.bind(this))
        .on('change', this._onContainerChange.bind(this))
        .on('error', this._onError.bind(this));
};

/**
 * Callback on the first containers list received
 *
 * @param {Array} containers
 * @private
 */
HostUpdater.prototype._onContainerSetup = function(containers) {
    //console.log(containers);
    this._proxy = this._getProxyContainer(containers);
    if (this._proxy) {
        this._poolProxyMonitoringEndpoint();
    } else {
        console.log("No proxy detected");
    }
};

/**
 * Return the proxy monitoring port
 *
 * @param {Object} proxy
 * @returns {Number}
 * @private
 */
HostUpdater.prototype._getProxyPort = function (proxy) {
    return proxy.ports.filter(function(mapping) {
        return mapping.PublicPort !== 80;
    })[0].PublicPort;
};

/**
 * Return the proxy address
 *
 * @param {object} proxy
 * @returns {String}
 * @private
 */
HostUpdater.prototype._getProxyIPAddress = function (proxy) {
    return proxy.hostname;
};

/**
 * Return the proxy monitoring endpoint
 *
 * @param {object} proxy
 * @returns {String}
 * @private
 */
HostUpdater.prototype._getProxyEndpoint = function (proxy) {
    return 'http://' + this._getProxyIPAddress(proxy) + ':' + this._getProxyPort(proxy) + '/routes';
};

HostUpdater.prototype._writeEtcHosts = function(hostsMap) {
    var contents = fs.readFileSync('/etc/hosts').toString();
    var startTag = '## etc-hosts-updater:start';
    var endTag = '## etc-hosts-updater:end';
    var startTagRegex = new RegExp(startTag);
    var endTagRegex = new RegExp(endTag);
    var new_contents = [];
    var in_block = false;

    var getBlockContents = function() {
        var data = ['', startTag];
        hostsMap.forEach(function(host){
            data.push(host.ip + '    ' + host.names.join(' '));
        });
        data.push(endTag, '');
        return data;
    };

    contents.split("\n").forEach(function(line) {
        if (in_block) {
            if (line.match(endTagRegex)) {
                in_block = false;
            }
        } else if(line.match(startTagRegex)) {
            in_block = true;
        } else {
            new_contents.push(line);
        }
    });

    new_contents = new_contents.concat(getBlockContents());

    if(new_contents === contents) {
        return;
    }

    // backup /etc/hosts
    var date = new Date();
    var backup_file = '/etc/hosts-' + date.toJSON().replace(/[:\.]+/g, '-') + '.bak';
    //fs.createReadStream('/etc/hosts').pipe(fs.createWriteStream(backup_file));
    //fs.writeFileSync('/etc/hosts', new_contents.join("\n"));

    console.log("File /etc/hosts backed-up and updated. Waiting for new changes...");
    console.log(new_contents.join("\n"));
};



/**
 * Write to /etc/hosts
 *
 * @param {Array|false} routes
 * @private
 */
HostUpdater.prototype._computeHosts = function(routes) {

    if (routes && routes.length) {

        var proxy_ip = this._getProxyIPAddress(this._proxy);

        if (!proxy_ip) {
            return console.error(("Cannot find proxy IP !"));
        }

        var hosts = routes.map(function(route) {
            return {ip: proxy_ip, names: [route.host]};
        });

        var hostByIp = _.groupBy(hosts, function(el) {
            return el.ip;
        });

        var hostsMap = [];
        _.each(hostByIp, function(value, key) {
            hostsMap.push({ip : key, names: _.uniq(_.flatten(value.map(function(el){ return el.names; })))});
        });

        return hostsMap;
    }

    return [];
};

HostUpdater.prototype._poolProxyMonitoringEndpoint = function() {
    request(this._getProxyEndpoint(this._proxy), function (error, response) {
        if (!error && response.statusCode === 200) {
            var results = JSON.parse(response.body);
            this._writeEtcHosts(
                this._computeHosts(results)
            );
        } else {
            console.error(error);
        }
    }.bind(this));
};


/**
 * Callback on containers list changes
 *
 * @param {Array} containers
 * @private
 */
HostUpdater.prototype._onContainerChange = function(containers) {
    this._proxy = this._getProxyContainer(containers);
    if (this._proxy) {
        this._poolProxyMonitoringEndpoint();
    } else {
        console.log("No proxy detected");
    }
};

/**
 * Error callback
 *
 * @param {String} err
 * @private
 */
HostUpdater.prototype._onError = function(err) {
    console.error("Error while watching containers: %s", err);
};

/**
 * Retrieve the proxy container
 *
 * @param {Array} containers
 * @returns {objects|boolean}
 * @private
 */
HostUpdater.prototype._getProxyContainer = function(containers) {
    var cnts = containers
        .filter(function(cnt) { return cnt.running; })
        .filter(function(cnt) { return cnt.is_proxy; });

    return cnts.length ? cnts[0] : false;
};


if (ON_BACKGROUND) {
    require('daemon')();
}

var updater = new HostUpdater();
updater.run();

