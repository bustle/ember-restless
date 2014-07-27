/**
 * The LocalStorageAdapter uses browser's localStorage as persistence storage
 *
 * We save the following metadata per model in _modelsMeta array
 * {
 *   keys: []          //Array of all the keys generated in order
 *   circularLimit: <> //Maximum number of items that can be saved (-1 for 
 *                     //unlimited items)
 * }
 *
 * @class LSAdapter
 * @namespace RESTless
 * @extends RESTless.Adapter
 */
RESTless.LSAdapter = RESTless.Adapter.extend({

  /*
   * serializer: default to a JSON serializer
   */
  serializer: RESTless.JSONSerializer.create(),

  /*
   * saveRecord: Saves data to localStorage
   */
  saveRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        primaryKey = get(record.constructor, 'primaryKey'),
        isNew = record.get('isNew'),
        dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record),
        modelMeta = this._getModelMeta(record);

    /*
     * If primaryKey is not provided, we must generate it from tail value and
     * insert depending on circularLimit
     */
    record.set('isSaving', true);
    if(isNone(record.get(primaryKey))) {
      dataStore = this._itemInsert(record);
    } else {
      dataStore[record.get(primaryKey)] = record.__data;
      // If key is not already stored, save it
      if(modelMeta.keys.indexOf(record.get(primaryKey)) === -1) {
        modelMeta.keys.push(record.get(primaryKey));
        this._updateModelMeta(modelMeta, dataStoreName);
      }
    }

    try{
      localStorage.setItem(dataStoreName, JSON.stringify(dataStore));
      record.onSaved(isNew);
      deferred.resolve(record);
    } catch (err) {
      record.onError(err);
      deferred.reject(err);
    }

    return deferred.promise;
  },

  /*
   * deleteRecord: Deletes a record from localStorage datastore
   */
  deleteRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record),
        primaryKey = get(record.constructor, 'primaryKey'),
        key = record.get(primaryKey),
        modelMeta = this._getModelMeta(record);

    if(dataStore[key]) {
      if(modelMeta && modelMeta.keys) {
        modelMeta.keys.splice(modelMeta.keys.indexOf(key), 1);
      }
      delete(dataStore[key]);
      try{
        // Put the array back in LS
        localStorage.setItem(dataStoreName, JSON.stringify(dataStore));
        this._updateModelMeta(modelMeta, dataStoreName);
        record.onDeleted();
        deferred.resolve(record);
      } catch (err) {
        record.onError(err);
        deferred.reject(err);
      }
    }

    return deferred.promise;
  },

  /*
   * reloadRecord: Reload data into record from dataStore
   */
  reloadRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        primaryKey = get(record.consturctor, 'primaryKey'),
        key = record.get(primaryKey),
        dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record),
        recordFromKey = this.recordByKey(dataStore, key);

    if(recordFromKey) {
      record.deserialize(recordFromKey);
      record.onLoaded();
      deferred.resolve(record);
    } else {
      record.onError('error');
      deferred.reject('error');
    }

    return deferred.promise;
  },

  /*
   * findAll: Returns all the records
   */
  findAll: function(model) {
    return this.findQuery(model);
  },

  /*
   * findQuery: Query a record
   */
  findQuery: function(model, queryParams) {
    var resourceInstance = model.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent(),
        dataStoreName = this._getDSName(resourceInstance),
        dataStore = this._getDataStore(resourceInstance),
        items = [], itemsA;

    for(var key in dataStore) {
      if(dataStore[key]) {
        items.push(dataStore[key]);
      }
    }

    itemsA = Ember.A(items);
    if(queryParams) {
      itemsA = itemsA.filter(function(item, index, enumerable) {
        for(var key in queryParams) {
          if(queryParams.hasOwnProperty(key) && item[key] !== queryParams[key]) {
            return false;
          }
        }
        return true;
      }); 
    }
    result.deserializeMany(model.toString(), itemsA);
    result.onLoaded();
    return result;
  },

  /*
   * findByKey: Find a record by given key
   */
  findByKey: function(model, key, queryParams) {
    var result = model.create({isNew: false}),
        dataStoreName = this._getDSName(result),
        dataStore = this._getDataStore(result),
        primaryKey = get(model, 'primaryKey'),
        recordFromKey = this.recordByKey(dataStore, key);

    if(recordFromKey) {
      result.deserialize(recordFromKey);
      result.onLoaded();
      return result;
    }

    return null;
  },

  /*
   * deleteAll: Deletes all records
   */
  deleteAll: function(model) {
    var deferred = Ember.RSVP.defer(),
        resourceName = get(model, 'resourceName'),
        dataStore = localStorage.getItem(resourceName),
        record = model.create({isNew: true}),
        modelMeta = this._getModelMeta(record);

    modelMeta.keys = [];
    this._updateModelMeta(modelMeta, resourceName);
    if(dataStore) {
      try{
        delete(localStorage[resourceName]);
        deferred.resolve();
      } catch (err) {
        deferred.reject(err);
      }
    } else {
      deferred.resolve();
    }

    return deferred.promise;
  },

  /*
   * Returns record by key
   */
  recordByKey: function(dataStore, key) {
    if(dataStore[key]) {
      return dataStore[key];
    } else {
      return null;
    }
  },

  /*
   * Modifies circularLimit value. If we have more items, this will truncate
   * the dataStore. -1 is for unlimited storage
   */
  setCircularLimit: function(model, climit) {
    var record = model.create({isNew: true}),
        dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record),
        modelMeta = this._getModelMeta(record),
        keys = modelMeta.keys,
        circularLimit = modelMeta.circularLimit;

    if(climit <= 0) { 
      modelMeta.circularLimit = -1;
    } else {
      // If we have more data than new limit, delete overflowing data
      if(keys.length > climit) {
        for(var i = 0; i < keys.length - climit; i++) {
          delete(dataStore[keys[i]]);
        }
        localStorage.setItem(dataStoreName, JSON.stringify(dataStore));
        keys.splice(0, keys.length - climit);
        modelMeta.keys = keys;
        modelMeta.circularLimit = climit;
      }
    }
    this._updateModelMeta(modelMeta, dataStoreName);
  },

  /*
   * getDSName: Returns dataStore name for this resource in localStorage
   */
  _getDSName: function(record) {
    return get(record.constructor, 'resourceName');
  },

  /*
   * Returns dataStore from localStorage for this resource
   */
  _getDataStore: function(record) {
    var dSName = this._getDSName(record),
        dataStore = localStorage.getItem(dSName);
            
    if(!dataStore) {
      return {};
    }

    return JSON.parse(dataStore);
  },

  /*
   * Inserts item into the datastore reading circular limit
   */
  _itemInsert: function(record) {
    var primaryKey = get(record.constructor, 'primaryKey'),
        dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record),
        modelMeta = this._getModelMeta(record),
        keys = modelMeta.keys,
        circularLimit = modelMeta.circularLimit,
        key = (keys.length > 0) ? keys[keys.length - 1] + 1 : 0;
    // If circularLimit is not -1, then we need to limit number of entries
    // that could be saved
    if(circularLimit >= 0) {
      // Check if we have maxed out on total number of items
      if(circularLimit - keys.length <= 0) {
        delete(dataStore[keys[0]]);
        keys.splice(0, 1);
      }
      record.set(primaryKey, key);
      dataStore[key] = record.__data;
      keys.push(key);
    } else {
      // Insert and increment tail since we can store unlimited items
      record.set(primaryKey, key);
      dataStore[key] = record.__data;
      keys.push(key);
    }

    modelMeta.keys = keys;
    this._updateModelMeta(modelMeta, dataStoreName);
    return dataStore;
  },

  /*
   * Returns meta data associated with this model
   */
  _getModelMeta: function(record) {
    var dataStoreName = this._getDSName(record),
        dataStore = this._getDataStore(record);

    // Get meta data for this model. Insert if not available already
    var modelsMeta = localStorage.getItem('_modelsMeta');

    if(isNone(modelsMeta)) {
      modelsMeta = {};
      localStorage.setItem('_modelsMeta', JSON.stringify(modelsMeta));
    } else {
      modelsMeta = JSON.parse(modelsMeta);
    }

    var modelMeta = modelsMeta[dataStoreName];

    if(isNone(modelMeta)) {
      var cLimit = get(record.constructor, 'circularLimit');

      if(isNone(cLimit) || cLimit.isNaN) {
        cLimit = -1;
      }

      modelMeta = {
        keys: [],
        circularLimit: cLimit
      };

      modelsMeta[dataStoreName] = modelMeta;
      localStorage.setItem('_modelsMeta', JSON.stringify(modelsMeta));
    }
    return modelMeta;
  },

  /*
   * Replaces meta data of given model with provided meta data
   */
  _updateModelMeta: function(modelMeta, dataStoreName) {
    var modelsMeta = localStorage.getItem('_modelsMeta');

    if(isNone(modelsMeta)) {
      modelsMeta = {};
      localStorage.setItem('_modelsMeta', JSON.stringify(modelsMeta));
    } else {
      modelsMeta = JSON.parse(modelsMeta);
    }

    modelsMeta[dataStoreName] = modelMeta;
    localStorage.setItem('_modelsMeta', JSON.stringify(modelsMeta));
  }
});

/*
 * reopenClass to add deleteAll and setCircularLimit as properties
 */
RESTless.Model.reopenClass({
  /*
   * deleteAll: Delete all records
   */
  deleteAll: function(params) {
    return get(this, 'adapter').deleteAll(this, params);
  },

  /*
   * setCircularLimit: Updates circular limit value
   */
  setCircularLimit: function(climit) {
    return get(this, 'adapter').setCircularLimit(this, climit);
  }
});

