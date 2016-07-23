/**
 * Authentication Middleware.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/

'use strict';

const debug  = require('debug')('backend:auth');

module.exports = class Auth {
  constructor(db) {
    this.db = db;
    this.SCRYPT_PARAMS = {N: 10, r:8, p:8};
    debug('constructor', 'setup');
  }

  /**
   * Return a ExpressJS middleware for checking authentication.
   *
   * @return {Function} ExpressJS middleware.
   **/
  requireAuthentication() {
    debug('express', 'generated middleware');

    let db = this.db;

    return (req, res, next) => {
      let PROVIDED_AUTH = req.get('Authentication') || req.body.apikey;
      if(!PROVIDED_AUTH) {
        return res.error(401, 'INVALID_AUTHENTICATION_APIKEY');
      }

      let PROC_AUTH     = PROVIDED_AUTH.split(':');

      if(!PROC_AUTH) {
        return res.error(401, 'INVALID_AUTHENTICATION_APIKEY');
      }

      // processed authentication.
      let API_PUBLIC    = PROC_AUTH[0];
      let API_SECRET    = PROC_AUTH[1];

      db.search('users', 'value.api.public: "'+ API_PUBLIC +
      '" value.api.secret: "' +                 API_SECRET + '"')
      .then(results => {
        if(results.body.count === 0) {
          return res.error(401, 'INVALID_AUTHENTICATION_APIKEY');
        }

        let user = results.body.results[0].value;
        let key  = results.body.results[0].path.key;

        debug('checkAuth', 'set req#user -> user')
        req.user = user;
        req.user.id = key;

        return next();
      })
      .fail(err => {
        debug('checkAuth', err);
        return res.error(500, 'INTERNAL');
      });
    }
  }

  /**
   * Get a user object from APIKEY from the database.
   *
   * @returns {Object} User Object.
   **/
  getUserObject(username) {
    return new Promise((fulfill, reject) => {
      this.db.search('users', 'username:"'+username+'"')
      .then(results => {
        if(results.body.count === 0) return reject('MATCHED_NONE');
        return fulfill(results.body.results);
      })
      .fail(err => {
        return reject(err);
      });
    });
  }

  getUserWorkspace(username) {
    return new Promise((fulfill, reject) => {
      this.db.search('users', 'username:'+username)
      .then(results => {
        if(results.body.count === 0) return reject('MATCHED_NONE');

        let user = results.body.results[0].value;

        if(typeof user.docker !== 'object') {
          return reject('NOT_INITIALIZED');
        }

        return fulfill(user.docker)
      })
      .fail(err => {
        return reject(err);
      });
    });
  }
}
