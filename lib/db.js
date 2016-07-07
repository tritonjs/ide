/**
 * Database Layer.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

'use strict';

const debug = require('debug')('backend:db');
const orch  = require('orchestrate');

class DB {
  constructor(apikey) {
    this.db     = orch(apikey);

    debug('constructor', 'success');
  }

  setConfig(config) {
    if(typeof config !== 'object') {
      return false;
    }

    this.db = orch(config.db.apikey);
    debug('setConfig', 'set');
  }

  search(collection, query) {
    return this.db.search(collection, query);
  }

  /**
   * Get a Key's value.
   *
   * @param {String} collection - collection to search in.
   * @param {String} key - key path.
   *
   * @returns {Promise} w/ data on success.
   **/
  get(collection, key) {
    return this.db.get(collection, key);
  }

  /**
   * Post Data into a collection
   *
   * @param {String} collection - to insert into.
   * @param {Variable} data - data to insert.
   *
   * @returns {Promise} API Result.
   **/
  post(collection, data) {
    return this.db.post(collection, data);
  }

  /**
   * Put Data into a collection
   *
   * @param {String} collection - to insert into.
   * @param {String} key - key to insert into.
   * @param {Variable} data - data to insert.
   *
   * @returns {Promise} API Result.
   **/
  put(collection, key, data) {
    return this.db.put(collection, key, data);
  }

  /**
   * Post Data into a collection
   *
   * @param {String} collection  - to interact with
   * @param {String} key         - key to remove.
   * @param {Object} hist        - tbh... idk
   *
   * @returns {Promise} API Result.
   **/
  remove(collection, key, hist) {
    return this.db.remove(collection, key, hist);
  }

  update(collection, key, data) {
    return this.db.merge(collection, key, data);
  }
}

module.exports = DB;
