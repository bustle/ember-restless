import Adapter from '../src/adapters/adapter';
import JSONSerializer from '../src/serializers/json-serializer';
import RecordArray from '../src/model/record-array';

var get = Ember.get;
var RSVPPromise = Ember.RSVP.Promise;

/**
  The FixtureAdapter is used for working with predefined
  javascript data stored in memory.

  @class FixtureAdapter
  @beta
  @namespace RESTless
  @extends RESTless.Adapter
*/
var FixtureAdapter = Adapter.extend({

  serializer: JSONSerializer.create(),

  /**
    Saves a record. Pushes a new record to fixtures, or updates an existing record.
    @method saveRecord
    @param {RESTless.Model} record record to be saved
    @return {Ember.RSVP.Promise}
   */
  saveRecord: function(record) {
    var isNew = record.get('isNew');
    var fixtures = record.constructor.FIXTURES;
    var primaryKey = get(record.constructor, 'primaryKey');
    var adapter = this, serializedRecord;

    if(!isNew && !record.get('isDirty')) {
      return new RSVPPromise(function(resolve){
        resolve(record);
      });
    }

    record.set('isSaving', true);

    // If no fixtures for class, create
    if(!fixtures) {
      record.constructor.FIXTURES = fixtures = [];
    }

    // assign a guid for new records
    if(Ember.isNone(record.get(primaryKey))) {
      record.set(primaryKey, this.generateIdForRecord(record));
    }

    // serialize a to a flat record and include relationship data
    serializedRecord = record.serialize({ nonEmbedded: true, includeRelationships: true });

    return new RSVPPromise(function(resolve, reject) {
      var index;
      if(isNew) {
        // Push new records onto fixtures array
        fixtures.push(serializedRecord);
        record.onSaved(true);
        resolve(record);
      } else {
        // update existing record
        index = adapter._findFixtureRecordIndex(record);
        if(index !== -1) {
          fixtures[index] = serializedRecord;
          record.onSaved(false);
          resolve(record);
        } else {
          record.onError();
          reject(null);
        }
      }
    });
  },

  /**
    Deletes a record from fixtures array
    @method deleteRecord
    @param {RESTless.Model} record record to be deleted
    @return {Ember.RSVP.Promise}
   */
  deleteRecord: function(record) {
    var adapter = this;
    return new RSVPPromise(function(resolve, reject) {
      var index;
      if(!record.constructor.FIXTURES) {
        record.onError();
        reject(null);
      }
      index = adapter._findFixtureRecordIndex(record);
      if(index !== -1) {
        record.constructor.FIXTURES.splice(index, 1);
        record.onDeleted();
        resolve(record);
      } else {
        record.onError();
        reject(null);
      }
    });
  },

  /**
    Finds all records of specified class in fixtures array
    @method findAll
    @param {RESTless.Model} klass model type to find
    @return {RESTless.RecordArray}
   */
  findAll: function(klass) {
    return this.findQuery(klass);
  },

  /**
    Finds records with specified query params in fixtures array
    @method findQuery
    @param {RESTless.Model} klass model type to find
    @param {Object} queryParams hash of query params
    @return {RESTless.RecordArray}
   */
  findQuery: function(klass, queryParams) {
    var fixtures = klass.FIXTURES;
    var result = null, fixturesA;

    if(!fixtures) {
      return result;
    }

    fixturesA = Ember.A(fixtures);
    if(queryParams) {
      fixturesA = fixturesA.filter(function(item) {
        for(var key in queryParams) {
          if(queryParams.hasOwnProperty(key) && item[key] !== queryParams[key]) {
            return false;
          }
        }
        return true;
      });
    }
    
    result = RecordArray.createWithContent();
    result.deserializeMany(klass, fixturesA);
    result.onLoaded();
    return result;
  },

  /**
    Finds record with specified primary key in fixtures
    @method findByKey
    @param {RESTless.Model} klass model type to find
    @param {Number|String} key primary key value
    @return {RESTless.Model}
   */
  findByKey: function(klass, key) {
    var fixtures = klass.FIXTURES;
    var primaryKey = get(klass, 'primaryKey');
    var result = null, keyAsString, fixtureRecord;

    if(!fixtures) {
      return result;
    }

    keyAsString = key.toString();
    fixtureRecord = Ember.A(fixtures).find(function(r) {
      return r[primaryKey].toString() === keyAsString;
    });
    if(fixtureRecord) {
      result = klass.create({ isNew: false });
      result.deserialize(fixtureRecord);
      result.onLoaded();
    }
    return result;
  },

  /**
    Generates a uuid for a new record.
    @method generateIdForRecord
    @param {Object} record
    @return {String} uuid
  */
  generateIdForRecord: function(record) {
    return parseInt(Ember.guidFor(record).match(/(\d+)$/)[0], 10);
  },

  /**
    @method _findFixtureRecordIndex
    @private
  */
  _findFixtureRecordIndex: function(record) {
    var klass = record.constructor;
    var fixtures = klass.FIXTURES;
    var primaryKey = get(klass, 'primaryKey'), fixtureRecord;
    if(fixtures) {
      fixtureRecord = fixtures.findProperty(primaryKey, record.get(primaryKey));
      return fixtures.indexOf(fixtureRecord);
    }
    return -1;
  }
});

export default FixtureAdapter;
