![Muguet](assets/muguet.png)

# Muguet

[![Coverage Status](https://coveralls.io/repos/mattallty/docker-http-reverse-proxy/badge.svg?branch=master&service=github)](https://coveralls.io/github/mattallty/docker-http-reverse-proxy?branch=master)

## Introduction

When using Docker, it's sometimes a pain to access your containers using specific IPs/ports.
Muguet provides you with a DNS Server that resolves auto-generated hostnames to your containers IPs,
plus a reverse proxy to access all your web apps on port 80. 

<p align="center">
  <img src="https://github.com/mattallty/muguet/blob/master/assets/muguet-schema.png">
</p>

## Prerequisites

  - A running [Docker](https://www.docker.com/) environment
  - [Node.js](https://nodejs.org/) or [io.js](https://iojs.org)
  

## Install

 - **Install Muguet**
```bash
npm install -g muguet
```

 - **Setup a new resolver**
 
Create a file `/etc/resolver/docker` with the following content: 

```
nameserver 127.0.0.1
port 9999
```
 

## Usage

```bash
sudo muguet [options]

# or
sudo -E bash -c 'muguet [options]'

```

Notes:
  - *Muguet* must be run as *root* to be able to bind port 80
  - `sudo -E bash -c 'muguet [options]'` is recommended as it allows you to pass environment variables, such as *DOCKET_HOST*,
    from the sudoer to the executed command run as *root*.

Available options:

```
-h | --help            Display help
--domain[=docker]      Set your domain. (set the /etc/resolver/{domain} accordingly)
--api-port[=9876]      Set the REST API port
--dns-ip[=127.0.0.1]   IP of the DNS server
--dns-port[=9999]      Set the DNS server port
```

## Generated hostnames

For each container, *Muguet* generates several DNS entries:

  - `container_id`.docker
  - `hostname`.docker (when running a container with -h option)
  - `compose-service`.docker (if using Docker Compose)
  - And possibly others based on the `org.muguet.hostname-map` label (see below) 


### Examples

```yml
# site1 will be accessible on http://site1.docker 
site1:
  build: ./build/docker/site1
  ports:
    - "8081"
  labels:
    # We enable the reverse-proxy so the app will be available on port 80 rather than 8081
    - "org.muguet.reverse-proxy.enabled=1" 
    
# site2 will be accessible on http://site2.docker and on http://back-office.docker 
site2:
  build: ./build/docker/site2
  hostname: back-office
  ports:
    - "8082"
  labels:
    # We enable the reverse-proxy so the app will be available on port 80 rather than 8082
    - "org.muguet.reverse-proxy.enabled=1"
      
# More complex      
# despite not recommended, this container expose several services (mysql, apache, node.js)
# So we have to setup a subdomain-map so each service will be given a distinct hostname
bigcontainer: 
  image: big/big-container
  ports:
    - "3306"
    - "80"
    - "8990"
  labels:
    # Enable reverse-proxy
    - "org.muguet.reverse-proxy.enabled=1"
    # Reverse-proxy only web apps, but NOT MySQL
    - "org.muguet.reverse-proxy.only-ports=80,8990"
    # Will bind:
    #   apache.bigcontainer.docker
    #   nodejs.bigcontainer.docker
    #   mysql.bigcontainer.docker
    - "org.muguet.subdomain-map=apache:80,nodejs:8990,mysql:3306"
    
```
    
---

## Labels

Docker `labels` are used as configuration settings.

#### org.muguet.reverse-proxy.enabled

Set it to `1` to enable the reverse-proxy (only enable reverse-proxy for web apps).


#### org.muguet.reverse-proxy.only-ports

A comma-separated list of ports that you want to *proxify*. 


#### org.muguet.subdomain-map

A comma-separated list of `subdomain:port` to map.


## REST API

A REST API is available on port `9876` to retrieve the proxy 
status and configuration. You can customize the port by passing 
the environment variable var `HTTP_PROXY_API_PORT` to the proxy 
container:

```yml
# [...]
    
proxy:
  image: mattallty/docker-http-reverse-proxy
  ports:
    - "80:80"
  environment:
    - "HTTP_PROXY_API_PORT=7777"
    
# [...]    
```    
