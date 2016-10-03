/**
 * http-proxy to handle ide image routing.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.1.0
 * @license MIT
 **/


global.DNSCACHE = {};

let CONFIG;
try {
  CONFIG = require('./config/config.json')
} catch(e) {
  console.log('Error:', 'no config found. (./config/config.json)');
  console.log('Stack Trace:', e);
  process.exit(1)
}

if(CONFIG.debug === undefined || CONFIG.debug === true) {
  process.env.DEBUG = 'backend:*,workspace:*,triton:*'
  process.env.TERM = 'xterm'
}

if(CONFIG.colors) {
  process.env.DEBUG_COLORS = '1'
}

// npm modules
const express   = require('express');
const httpProxy = require('http-proxy');
const debug     = require('debug')('triton:ide');
const async     = require('async');
const fs        = require('fs');

// our libs
const Auth      = require('./lib/auth.js');
const Db        = require('./lib/db.js');
const Containers = require('./lib/containers.js');

// express middleware
const cp        = require('cookie-parser');
const error     = require('./lib/error.js');

let dbctl = new Db(CONFIG);
let auth  = new Auth(dbctl);
let container = new Containers(auth, true);
let app = express();

container.stream();

// cookie-parser for determining which to use
app.use(cp());

let wsproxy;
let CONTAINER_ID, CONTAINER_SHORT_ID, proxy;
async.waterfall([
  next => {
    proxy = httpProxy.createProxyServer({});

    proxy.on('error', function (err, req, res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });

      debug('proxy:err', err);
      res.end('Something went wrong. And we are reporting a custom error message.');
    });

    return next();
  },

  // Determine our docker id (if present.)
  next => {
    let raw_id = fs.readFileSync('/proc/self/cgroup', 'utf8');
    let id_rgx = /1[\w:\/=]+\/([\w\d]+)/g.exec(raw_id);

    let ID = null;
    if(!id_rgx) {
      debug('regex failed');
      debug(raw_id, id_rgx);
    } else {
      ID = id_rgx[1];
    }

    if(!ID) {
      console.error('Failed to determine the ID of the container');
    }

    debug('container id:', ID);
    CONTAINER_ID = ID;
    CONTAINER_SHORT_ID = ID.substr(0, 12);

    return next();
  },

  /**
   * Setup error module.
   **/
  next => {
    app.use(error(debug, {
      short: CONTAINER_SHORT_ID,
      long: CONTAINER_ID
    }));
    return next();
  },

  /**
   * Obtain the container information from the abstraction library
   * and then forward the requests.
   **/
  next => {
    app.get('/healthcheck', (req, res) => {
      // TODO: Check health here.
      return res.status(200).send('OK')
    });

    app.use((req, res) => {
      let apikey = req.cookies.triton_userapikey;
      let name   = req.cookies.triton_username;

      if(!apikey || !name) {
        debug('rejected request for workspace without apikey and/or username')
        return res.error('Invalid Authentication, please try logging in again.');
      }

      container.fetch(name, (container) => {
        if(!container.auth) container.auth = container.apikey; // terminology debate.

        if(apikey !== container.auth) {
          debug('AUTH_INVALID', apikey, '=/=', container.auth)
          debug('CONTAINER', container);
          debug('rejected invalid auth')
          return res.error('Invalid Authentication, please try logging in again.', false, 401)
        }

        return proxy.web(req, res, {
          target: {
            host: container.ip,
            port: 80
          }
        }, err => {
          debug('workspace wasn\'t available. IP:', container.ip);

          if(!container.ip) {
            debug('workspace container ip not helpful, here\'s container:', container);
          }

          debug('here\'s container for auth check', container);

          return res.error('Workspace Not Available (Is it running?)')
        });
      });
    });

    debug('listening on port', CONFIG.port);
    let appserver = require('http').createServer(app);
    appserver.on('upgrade', (req, socket, head) => {
      let parseCookies = request => {
        const list = {},
              rc = request.headers.cookie;

        rc && rc.split(';').forEach(cookie => {
          let parts = cookie.split('=');
          list[parts.shift().trim()] = decodeURI(parts.join('=')).replace(/%3A/g, ':'); // quick hack to replace %3 with :
        });

        return list;
      }

      let cookies = parseCookies(req);
      let name    = cookies.triton_username;
      let apikey  = cookies.triton_userapikey;

      container.fetch(name, (container) => {
        if(!container.auth) container.auth = container.apikey; // terminology debate.

        if(apikey !== container.auth) {
          debug('AUTH_INVALID', apikey, '=/=', container.auth)
          debug('CONTAINER', container);
          debug('rejected invalid auth')
          return;
        }

        let target = 'ws://'+container.ip+':80';

        debug('websocker', 'upgrade target ->', target)
        let wsproxy = httpProxy.createProxyServer({
          target: target,
          ws: true
        });

        wsproxy.ws(req, socket, head);
      });
    });

    appserver.listen(CONFIG.port);

    return next();
  },

  next => {
    let webproxy = express();

    webproxy.use(cp());
    webproxy.use(error(debug, {
      short: CONTAINER_SHORT_ID,
      long: CONTAINER_ID
    }));

    webproxy.use((req, res, done) => {
      let apikey = req.cookies.triton_userapikey;
      let name   = req.cookies.triton_username;

      if(!apikey || !name) {
        debug('rejected request for workspace without apikey and/or username')
        return res.error('Invalid Authentication, please try logging in again.');
      }

      container.fetch(name, (container) => {
        if(!container.auth) container.auth = container.apikey; // terminology debate.

        if(apikey !== container.auth) {
          debug('AUTH_INVALID', apikey, '=/=', container.auth)
          debug('CONTAINER', container);
          debug('rejected invalid auth')
          return res.error('Invalid Authentication, please try logging in again.', false, 401)
        }

        return proxy.web(req, res, {
          target: {
            host: container.ip,
            port: 8080
          }
        }, err => {
          debug('webproxy', 'failed to connect to service');
          return res.error('Failed to proxy service :(')
        });
      });
    })

    webproxy.listen(8080, () => {
      debug('webproxy', 'listening on *:8080')
      return next();
    });
  }
], err => {
  if(err) {
    console.error(err);
    return process.exit(1);
  }
})
