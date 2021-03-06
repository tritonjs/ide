/**
 * Retrieve a containers info from redis, or obtain from the database.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

const Redis = require('./redis.js')
const debug = require('debug')('tritonjs:ide:containers');


/**
 * Container Creator class.
 *
 * @param {Object} auth  - TritonJS Authentication Object.
 * @param {Object} redis - redis object.
 * @class ContainerCreator
 **/
class ContainerCreator {
  constructor(auth, stream) {

    // poll redis here.
    this._redis    = Redis();
    this._auth     = auth;
    this._cache    = {};

    if(stream) {
      debug('constructor', 'set to to stream changes instead of poll');
      this._stream = true;
      this._pub    = Redis();
    }
  }

  /**
   * Streams changes
   **/
  stream() {
    this._redis.subscribe('NewWorkspace', 'WorkspaceConflict', (err, count) => {
      debug('stream', 'sub to', count, 'channels');
    })

    this._redis.on('message', (channel, msg) => {
      let data;

      try {
        data = JSON.parse(msg);
      } catch(e) {
        debug('stream:message', 'failed to parse msg as JSON');
        return;
      }

      let username = data.username;
      if(!username) return debug('stream:message', 'invalid username:', username);

      debug('stream:process', channel, username, data);

      // write it to our cache.
      this._writeToCache(username, data);

      debug('stream:message', 'processed event type:', channel)
    })
  }

  /**
   * Return a containers object.
   *
   * @param {String} username - username of owner of wanted container.
   * @param {Function} done   - callback.
   **/
  fetch(username, done) {
    if(!done) return false;

    if(!this._stream) return this._pullFromRedis(username, done);

    return this._pullFromCache(username, done);
  }

  /**
   * Pull from our internal cache.
   **/
  _pullFromCache(username, done) {
    if(!this._cache[username]) return this._pullFromRedis(username, done);

    return done(this._cache[username]);
  }


  /**
   * Write user info to cache
   * @todo data checks.
   **/
  _writeToCache(username, data) {
    debug('cache:write', username, 'success');
    this._cache[username] = data;
  }

  /**
   * Internal function to just pull from redis.
   **/
  _pullFromRedis(username, done) {
    this._pub.get(username, (err, res) => {
      if(err) {
        debug('redis:pull', err);
      }

      if(!res) { // fetch from database instead.
        debug('redis:pull', 'invalid res, pulling from DB', res)
        return this._pullFromDatabase(username, done);
      }

      debug('redis:pull', 'success')

      // regardless of op mode, store in cache.
      let data = JSON.parse(res);
      this._writeToCache(username, data);

      return done(data);
    })
  }

  /**
   * Internal method of pulling from database.
   *
   * @param {String} username - username of owner of wanted container
   * @param {Function} done   - callback.
   **/
  _pullFromDatabase(username, done) {
    this._auth.getUserObject(username)
    .then(user => {
      debug('_pullFromDatabase', 'got user object');
      debug('_pullFromDatabase', user)
      if(!user) return done('invalid container response');

      if(!user.docker) {
        user.docker = {
          ip: null
        }
      }

      let cont = user.docker;
      cont.auth = user.api.public+':'+user.api.secret;


      debug('db:pull', cont);

      // fix API results.
      if(!cont.username) {
        cont.username = username;
      }

      let cont_str;
      try {
        cont_str = JSON.stringify(cont)
      } catch(e) {
        return debug('pull:db:parse', 'failed to stringify as JSON');
      }

      // if streaming, publish the NewWorkspace event.
      if(this._stream) {
        this._pub.publish('NewWorkspace', cont_str);
        this._pub.set(username, cont_str);
      } else {
        this._redis.set(username, cont_str);
      }

      return done(cont);
    })
    .catch(err => {
      return done(err);
    })
  }
}

module.exports = ContainerCreator;
