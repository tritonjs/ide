/**
 * http-proxy to handle ide image routing.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.1
 * @license MIT
 **/


global.DNSCACHE = {};

let CONFIG;
try {
  CONFIG = require('./config/config.json');
} catch(e) {
  console.error('Failed to load config', e);
  process.exit(1);
}

const express   = require('express');
const httpProxy = require('http-proxy');
const dockerode = require('dockerode');
const debug     = require('debug')('triton:ide');
const async     = require('async');
const fs        = require('fs');

const Auth      = require('./lib/auth.js');
const Db        = require('./lib/db.js');

const cp = require('cookie-parser');

let dbctl = new Db(CONFIG.apikey);
let auth  = new Auth(dbctl);


let app = express();

app.use(cp());

let proxy;

try {
  proxy = httpProxy.createProxyServer({});
} catch(e) {
  console.error('Failed to create proxy server', e);
}

let CONTAINER_ID, CONTAINER_SHORT_ID;
async.waterfall([
  // Determine out docker id (if present.)
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

  next => {

    // instill api normalization.
    app.use((req, res, done) => {
      res.error = (data, severe) => {
        let template = null;

        if(severe) {
          template = [
            '<h1>An Error has occurred.</h1>',
            '<br />',
            '<p>',
            'We\'re deeply sorry about this, please forward this',
            '<br />',
            'information to ',
            '<a href=\'mailto:jaredallard@outlook.com\'>jaredallard@outlook.com</a> ',
            'in order',
            '<br />',
            'to have this issue be resolved quickly.',
            '</p>',
            '<br /><br />',
            '<b>Error</b>:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;',
            data,
            '<br />',
            '<b>Container</b>: ',
            CONTAINER_SHORT_ID
          ];
        } else {
          template = [
            '<b>',
            data,
            '</b>',
            '<br /><br />',
            'CID: ',
            CONTAINER_SHORT_ID
          ];
        }

        res.send(template.join(''));
      }

      return done();
    })

    return next();
  },

  next => {
    app.use((req, res) => {
      let apikey = req.cookies.triton_apikey;
      let name   = req.cookies.triton_username;

      if(!apikey || !name) {
        debug('rejected request for workspace without apikey and/or username')
        return res.error('Invalid Authentication, please try logging in again.');
      }

      let done = (CACHED_OBJ) => {
        console.log('proxy', CACHED_OBJ.ip)
        return proxy.web(req, res, {
          target: CACHED_OBJ.ip
        }, () => {
          debug('workspace wasn\'t available.')
          return res.error('Workspace Not Available (Is it running?)')
        });
      };

      if(!global.DNSCACHE[name]) {
        auth.getUserObject(name)
        .then(user => {
          let O = user[0].value;

          if(!O.docker) {
            return res.error('Workspace hasn\'t been created for this user yet.');
          }

          let IP = O.docker.ip;

          if(IP === null) {
            return res.error('Docker container not assigned but marked valid.', true)
          }

          // create a new object in the "dns" cache.
          debug('proxy', name, '->', IP);
          global.DNSCACHE[name] = {
            ip: 'http://'+IP,
            success: true
          }

          return done(global.DNSCACHE[name]);
        })
        .catch(() => {
          global.DNSCACHE[name]
          return res.error('Failed to Resolve Workspace', true);
        })
      } else {
        return done(global.DNSCACHE[name]);
      }
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
