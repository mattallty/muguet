# "Etc Hosts" Updater

## Introduction

This script poll the Docker reverse proxy API and automatically 
updates your `/etc/hosts` file to map your containers IP addresses with custom 
sub-domains.

## Help

```

   Etc-Hosts Updater v1.0

   This script updates you /etc/hosts file to point your containers sub-domains to the proxy.

    NOTE: The following environment variables must be set:
       - DOCKER_HOST: The Docker Host, for example tcp://192.168.59.103:2376
       - DOCKER_CERT_PATH: Path to the docker certs directory
       
    WARNING:
       - This script MUST be run as root!
       - If run with sudo, use the following to make necessary env vars accessible:

           sudo -E bash -c 'node bin/etc-hosts-updater.js'

   Usage:

       As root: 
            node ./etc-hosts-updater [options]
       
       or with sudo:
            sudo -E bash -c 'node bin/etc-hosts-updater.js [options]' 

   Options:

       -b [--background]   Make the script run in background
       -h [--help]         Display this help
       
```



