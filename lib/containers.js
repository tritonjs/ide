/**
 * Retrieve a containers info from redis, or obtain from the database.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

const Redis = require('ioredis');
const debug = require('debug')('tritonjs:ide:containers');


/**
 * Container Creator class.
 *
 * @param {Object} auth  - TritonJS Authentication Object.
 * @param {Object} redis - redis object.
 * @class ContainerCreator
 **/
class ContainerCreator {
  constructor(auth, redis) {
    debug('contructor', redis);

    // poll redis here.
    this._redis = new Redis(redis);
    this._auth    = auth;
  }

  /**
   * Return a containers object.
   *
   * @param {String} username - username of owner of wanted container.
   * @param {Function} done   - callback.
   **/
  fetch(username, done) {
    if(!done) return false;

    this._redis.get(username, (err, res) => {
      if(!res) { // fetch from database instead.
        return this._pullFromDatabase(username, done);
      }

      return done(JSON.parse(res));
    })
  }

  /**
   * Internal method of pulling from database.
   *
   * @param {String} username - username of owner of wanted container
   * @param {Function} done   - callback.
   **/
  _pullFromDatabase(username, done) {
    this._auth.getUserWorkspace(username)
    .then(cont => {
      if(!cont) return done('invalid container response');

      this._redis.set(username, JSON.stringify(cont));
      return done(cont);
    })
    .catch(err => {
      return done(err);
    })
  }
}

module.exports = ContainerCreator;
