/**
 * http-proxy to handle ide image routing.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.1.0
 * @license MIT
 **/


global.DNSCACHE = {};

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


let CONFIG;
try {
  CONFIG = require('./config/config.json');
} catch(e) {
  console.error('Failed to load config', e);
  process.exit(1);
}

let dbctl = new Db(CONFIG);
let auth  = new Auth(dbctl);
let container = new Containers(auth, true);
let app = express();

container.stream();

// cookie-parser for determining which to use
app.use(cp());

let CONTAINER_ID, CONTAINER_SHORT_ID, proxy;
async.waterfall([
  next => {
    proxy = httpProxy.createProxyServer({});
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
        if(apikey !== container.auth) {
          debug('AUTH_INVALID', apikey, '=/=', container.auth)
          debug('CONTAINER', container);
          return res.error('Invalid Authentication, please try logging in again.', false, 401)
        }

        return proxy.web(req, res, {
          target: 'http://'+container.ip
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

    return next();
  }
], err => {
  if(err) {
    console.error(err);
    return process.exit(1);
  }

  debug('listening on port', CONFIG.port);
  app.listen(CONFIG.port);
})
