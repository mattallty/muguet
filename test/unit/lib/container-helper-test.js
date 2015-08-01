"use strict";

var   should = require('should')
    , DockerContainer = require('../../../lib/docker-container')
    , ContainersHelper = require('../../../lib/containers-helper')
    , ContainersFixtures = require('../../fixtures/containers')
;

describe('container-helper', function() {

    var containers = [
        new DockerContainer(ContainersFixtures.container1.basic_info, ContainersFixtures.container1.data),
        new DockerContainer(ContainersFixtures.container2.basic_info, ContainersFixtures.container2.data),
        new DockerContainer(ContainersFixtures.container4.basic_info, ContainersFixtures.container4.data)
    ];

    describe(".filterContainers(containers, DockerContainer.IS_RUNNING)", function () {
        it('should return an  array with 2 DockerContainer instances', function () {
            var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_RUNNING);
            should(result).be.length(2);
        });
    });

    describe(".filterContainers(containers, DockerContainer.IS_STOPPED)", function () {
        it('should return an  array with 1 DockerContainer instance', function () {
            var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_STOPPED);
            should(result).be.length(1);
        });
    });

    describe(".filterContainers(containers, DockerContainer.IS_PROXY)", function () {
        it('should return an  array with 1 DockerContainer instance', function () {
            var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_PROXY);
            should(result).be.length(1);
        });
    });

    describe(".filterContainers(containers, DockerContainer.IS_NOT_PROXY)", function () {
        it('should return an  array with 2 DockerContainer instances', function () {
            var result = ContainersHelper.filterContainers(containers, DockerContainer.IS_NOT_PROXY);
            should(result).be.length(2);
        });
    });

    describe(".filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED)", function () {
        it('should return an  array with 1 DockerContainer instance', function () {
            var result = ContainersHelper.filterContainers(containers, DockerContainer.HAS_PROXY_ENABLED);
            should(result).be.length(2);
        });
    });

});