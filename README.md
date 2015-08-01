![Muguet](assets/muguet.png)

# Muguet

[![Coverage Status](https://coveralls.io/repos/mattallty/docker-http-reverse-proxy/badge.svg?branch=master&service=github)](https://coveralls.io/github/mattallty/docker-http-reverse-proxy?branch=master)

## Introduction

When using Docker, it's sometimes a pain to access your containers using specific IPs/ports.
Muguet provides you with a DNS Server that resolves auto-generated hostnames to your containers IPs,
plus a reverse proxy to access all your web apps on port 80. 

![Muguet-Schema](assets/muguet-schema.png)

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
    
# site2 will be accessible on http://site2.docker as well as on http://back-office.docker 
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
# So we have to setup a hostname-map so each service will be given a distinct hostname:
#      
bigcontainer: 
  build: ./build/docker/my-container
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
    - "org.muguet.hostname-map=apache:80,nodejs:8990,mysql:3306"
    
```
    
In this example, these containers will be accessible on `site1.docker` and `site2.docker`, but also on `back-office.docker`.


---


## How it works
    
The reverse-proxy is itself a container that you will have to put in your `docker-compose.yml`.

So you config would look like this:

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "80"
  labels:
    - "org.dc.http-proxy.enabled=1"  
    
site2:
  build: ./build/docker/site2
  ports:
    - "80"    
  labels:
    - "org.dc.http-proxy.enabled=1"
      
proxy:
  image: mattallty/docker-http-reverse-proxy
  ports:
    - "80:80"     
```

**Important**: The proxy must specifically **bind the port 80 on the host**, and must be **the only one** to do so!

### Not using Docker Compose ?

You can also use this proxy without using *Docker Compose*.
In this case, the sub-domain name will be taken either from you container *label* named `org.dc.http-proxy.sub-domain`,
if it is present, or from the container id itself (but will be much less memorable).
Obviously, you will also have to set the *label* `org.dc.http-proxy.enabled=1` on your containers.

---

## Labels

Docker `labels` are used as configuration settings. Here is the list of recognized labels:

#### org.dc.http-proxy.enabled

Set it to 1 to enable proxying to the service.

Example:

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "80"
  labels:
    - "org.dc.http-proxy.enabled=1"  # Enable proxying for this container
```

#### org.dc.http-proxy.sub-domain

Used to specify a sub-domain. By default, the compose service name is used, ie `site1` or `site2` in the example.

Example:

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "80"
  labels:
    - "org.dc.http-proxy.enabled=1"
    - "org.muguet.sub-domain=foo" # Will serve this container on http://foo.docker
```

#### org.dc.http-proxy.only-ports

A comma-separated list of ports that you want to proxify. Useful if one of your containers expose multiple ports, 
but some of them don't need to be proxied.

Example:

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "80"
    - "8888"
    - "3306"
  labels:
    - "org.dc.http-proxy.enabled=1"
    - "org.dc.http-proxy.only-ports=80,8888"  # Will only proxify ports 80 and 8888
```


#### org.dc.http-proxy.web-port 

The port to proxify on port 80. 
Useful if one of your containers expose multiple ports, but you want that a specific one maps to port 80.

Example:

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "9999"
    - "8888"
  labels:
    - "org.dc.http-proxy.enabled=1"
    # Will only proxify port 8888 on 80, and port 9999 to another one.
    - "org.dc.http-proxy.web-port=8888"
```

## Examples

### Custom sub-domain

This will use use `foo` as sub-domain instead if `site1`, so you service will be accessible on `http://foo.docker`.

```yml
site1:
  build: ./build/docker/site1
  ports:
    - "80"
  labels:
    - "org.dc.http-proxy.enabled=1"  
    - "org.dc.http-proxy.subdomain=foo"
```

### Multiple ports

**Warning**: This example is not an ideal example as it is contrary to the micro-service dogma.
You would better slice your services into smaller pieces.

Let's say one of your containers listen on several ports in order to 
run apache on port 80, a node.js app that listen on port 8888, and mysql on port 3306.

So you only want to proxify apache and nodejs. 

```yml
## WORKS BUT NOT A IDEAL
app:
  build: ./build
  ports:
    - "80"
    - "8888:8888"
    - "3306"
  labels:
    - "org.dc.http-proxy.enabled=1"  # Enable proxy on this container
    - "org.dc.http-proxy.only-ports=80,8888" # Only proxy these ports
    
proxy:
  image: mattallty/docker-http-reverse-proxy
  ports:
    - "80:80"
```

With this config, apache will be accessible via `http://app.docker` and nodejs via `http://app.docker:8888`.
Notice that Apache has been given the port 80 on the proxy by priority (80 is privileged).

This solution is not good as you have to statically fix the port binding of 8888. 

As a **better solution**, you can write:
    
```yml
## MUCH BETTER
app:
  build: ./build
  ports:
    - "80"
    - "8888:8888"
    - "3306"
  labels:
    # Enable proxy on this container
    - "org.dc.http-proxy.enabled=1"
    # Only proxy these ports
    - "org.dc.http-proxy.only-ports=80,8888"
    # Will proxify the port 80 on http://apache.docker
    - "org.dc.http-proxy.port-80-subdomain=apache"
    # Will proxify port 8888 on http://nodejs.docker
    - "org.dc.http-proxy.port-8888-subdomain=nodejs"
    
proxy:
  image: mattallty/docker-http-reverse-proxy
  ports:
    - "80:80"
```    

## Custom domain

By default, the proxy uses `dock.dev` as domain. 
You can change it by passing the env var `HTTP_PROXY_DOMAIN` to the proxy container:

```yml
# [...]
    
proxy:
  image: mattallty/docker-http-reverse-proxy
  ports:
    - "80:80"
  environment:
    - "HTTP_PROXY_DOMAIN=mydomain.local"
    
# [...]    
```    

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
