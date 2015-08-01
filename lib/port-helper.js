"use strict";

var PortHelper = function() {

};

PortHelper.prototype.getMappedPort = function(clean_ports, port_map, hasAlready80Bound, web_port) {
    if ((!hasAlready80Bound && (clean_ports.length === 1 || port_map.PrivatePort === 80))
        || port_map.PrivatePort === web_port) {
        return 80;
    }
    return port_map.PublicPort;
};

PortHelper.prototype.filter = function(cnt) {

    var filterNonTcpPorts = function(port_mapping) {
        if (port_mapping.Type !== 'tcp') {
            console.log("Skipping UDP port %s for container %s", port_mapping.PublicPort, cnt.compose_service);
            return false;
        }
        return true;
    };

    var filterByPolicy = function(port_mapping) {
        if (cnt.only_ports && cnt.only_ports.indexOf(port_mapping.PrivatePort) === -1) {
            var msg = "Filtering tcp port %d by only-ports policy %s for container %s";
            console.log(msg, port_mapping.PrivatePort, cnt.only_ports, cnt.compose_service);
            return false;
        }
        return true;
    };

    return cnt.ports.filter(filterNonTcpPorts).filter(filterByPolicy);

};

module.exports = new PortHelper();