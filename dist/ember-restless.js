/**
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.4.0
 * last modifed: 2013-08-18
 *
 * Garth Poitras <garth22@gmail.com>
 * Copyright (c) 2013 Endless, Inc.
 */

(function(window, $, Ember, undefined){

"use strict";

var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

if (RESTless === undefined) {
  /**
   * Create RESTless as an Ember Namespace.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create();

  /**
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if (window !== undefined) {
    window.RL = window.RESTless = RESTless;
  }
}

/**
 * Attributes
 * Model property definitions
 */

// Standard attribute
RESTless.attr = function(type, opts) {
  var meta = Ember.merge({ type: type, isAttribute: true }, opts);
  return makeComputedAttribute(meta);
};

// belongsTo: One-to-one relationships
RESTless.belongsTo = function(type, opts) {
  var meta = Ember.merge({ type: type, isRelationship: true, belongsTo: true }, opts);
  return makeComputedAttribute(meta);
};

// hasMany: One-to-many & many-to-many relationships
RESTless.hasMany = function(type, opts) {
  var defaultArray = function() {
    return RESTless.RecordArray.createWithContent();
  },
  meta = Ember.merge({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
  return makeComputedAttribute(meta);
};

function makeComputedAttribute(meta) {
  return Ember.computed(function(key, value) {
    var data = this.get('_data');
    // Getter
    if (arguments.length === 1) {
      value = data[key];

      if (value === undefined) { 
        // Default values
        if (typeof meta.defaultValue === 'function') {
          value = meta.defaultValue();
        } else {
          value = meta.defaultValue;
        }
        data[key] = value;
      }
    }
    // Setter 
    else if (value !== data[key]) {
      data[key] = value;
      if (!meta.readOnly && !RESTless.ReadOnlyModel.detectInstance(this)) {
        this._onPropertyChange(key);
      }
    }
    return value;
  }).property('_data').meta(meta);
}

/*
 * Serializer
 * Base serializer to be subclassed.
 * Handles transforming data before saving to persistence layer
 * and transforming data into Models when retrieving
 */
RESTless.Serializer = Ember.Object.extend({
  /*
   * dataType: i.e. json, jsonp, xml, html
   */
  dataType: null,
  /*
   * contentType: additional content type headers
   */
  contentType: null,

  /* 
   * Common serializer methods to be implemented in a subclass
   */
  deserialize:         Ember.K,
  deserializeProperty: Ember.K,
  deserializeMany:     Ember.K,
  serialize:           Ember.K,
  serializeProperty:   Ember.K,
  serializeMany:       Ember.K,

  /*
   * prepareData: (optional override) preps data before persisting
   */
  prepareData: function(data) {
    return data;
  },
  /*
   * parseError: (optional override) deserialize error messages
   */
  parseError: function(error) {
    return error;
  }
});

/*
 * JSONSerializer
 * Serializes and deserializes data to and from json
 */
RESTless.JSONSerializer = RESTless.Serializer.extend({

  dataType: 'json',
  contentType: 'application/json; charset=utf-8',

  /* 
   * deserialize: translates json object into a model object
   */
  deserialize: function(resource, data) {
    if(!data) { return resource; }

    var key, prop;

    // Check for wrapped object by resource name: { post: { id:1, name:'post 1' } }
    // This is the default from ActiveRecord
    key = this._keyForResource(resource);
    if(data[key]) {
      data = data[key];
    }

    // iterate over each json property and deserialze
    Ember.beginPropertyChanges(resource);
    for(prop in data) {
      if (data.hasOwnProperty(prop)) {
        this.deserializeProperty(resource, prop, data[prop]);
      }
    }
    Ember.endPropertyChanges(resource);
    return resource;
  },

  /* 
   * deserializeProperty: sets model object properties from json
   */
  deserializeProperty: function(resource, prop, value) {
    var attrName = this.attributeNameForKey(resource, prop),
        fields = get(resource.constructor, 'fields'),
        field = fields.get(attrName), type, klass;

    // If the json contains a key not defined on the model, don't attempt to set it.
    if (!field) { return; }

    type = field.type;
    klass = get(Ember.lookup, type);

    // If property is a hasMany relationship, deserialze the array
    if (field.hasMany) {
      var hasManyArr = this.deserializeMany(resource.get(attrName), type, value);
      resource.set(attrName, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if (field.belongsTo && klass && value) {
      var belongsToModel = klass.create({ isNew: false }).deserialize(value);
      belongsToModel.onLoaded();
      resource.set(attrName, belongsToModel);
    }
    else {
      // Check for a custom transform
      if (type && RESTless.JSONTransforms[type]) {
        value = RESTless.JSONTransforms[type].deserialize(value);
      }
      resource.set(attrName, value);
    }
  },

  /* 
   * deserializeMany: deserializes an array of json objects
   */
  deserializeMany: function(recordArray, type, data) {
    if(!data) { return recordArray; }

    var klass = get(Ember.lookup, type), meta, keyPlural, len, i, item;

    // extract any meta info
    meta = this.extractMeta(data);
    if(meta) { recordArray.set('meta', meta); }

    // Check for wrapped array by resource name: { posts: [...] }
    // This is the default from ActiveRecord on direct finds
    if(!Ember.isArray(data)) {
      keyPlural = this._keyPluralForResourceType(type);
      if(data[keyPlural]) {
        data = data[keyPlural];
      } else {
        return recordArray;
      }
    }

    if(recordArray) {
      recordArray.clear();
    } else {
      recordArray = RESTless.RecordArray.createWithContent();
    }

    len = data.length;
    if(len) {
      Ember.beginPropertyChanges(recordArray);
      for(i=0; i<len; i++) {
        item = data[i];
        if(klass && typeof item === 'object') {
          item = klass.create({ isNew: false }).deserialize(item);
        }
        recordArray.pushObject(item);
      }
      Ember.endPropertyChanges(recordArray);
    }
    recordArray.onLoaded();
    return recordArray;
  },

  /* 
   * serialize: turns model into json
   */
  serialize: function(resource, options) {
    var fields = get(resource.constructor, 'fields'),
        json = {};

    fields.forEach(function(field, fieldOpts) {
      //Don't include readOnly properties or to-one relationships (unless specified)
      if (!fieldOpts.readOnly && (!fieldOpts.belongsTo || (fieldOpts.belongsTo && options && options.includeRelationships))) {
        var val = this.serializeProperty(resource, field, fieldOpts);
        if(val !== null) {
          json[this.keyForAttributeName(field)] = val;
        }
      }
    }, this);

    // By default, serialzed records are wrapped in a resource-named object
    // { post: { id:1, name:"first post" } }
    // The option 'nonEmbedded' returns { id:1, name:"first post" }
    if(options && options.nonEmbedded) {
      return json;
    } else {
      var wrapped = {};
      wrapped[this._keyForResource(resource)] = json;
      return wrapped;
    }
  },

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop, opts) {
    var value = resource.get(prop);

    if (!opts) {
      opts = resource.constructor.metaForProperty(prop);
    }
    if (opts && opts.hasMany) {
      return this.serializeMany(value.get('content'), opts.type);
    } else if(opts.belongsTo) {
      return this.serialize(value);
    }

    //Check for a custom transform
    if(opts.type && RESTless.JSONTransforms[opts.type]) {
      value = RESTless.JSONTransforms[opts.type].serialize(value);
    }
    return value;
  },

  /* 
   * serializeMany: serializes an array of models into json
   */
  serializeMany: function(recordArray, type) {
    var key = this._keyForResourceType(type),
        len = recordArray.length,
        result = [], i, item;
    for(i=0; i<len; i++) {
      item = recordArray[i];
      if(RESTless.Model.detectInstance(item)) {
        item = item.serialize();
      }
      result.push(item[key]);
    }
    return result;
  },

  /*
   * (private) shortcut helpers
   */
  _keyForResource: function(resource) {
    return this.keyForResourceName(get(resource.constructor, 'resourceName'));
  },
  _keyForResourceType: function(type) {
    var klass = get(Ember.lookup, type);
    return klass ? this._keyForResource(klass.create()) : null;
  },
  _keyPluralForResourceType: function(type) {
    var klass = get(Ember.lookup, type), adapter, resourceName;
    if(klass) {
      adapter = get(klass, 'adapter');
      resourceName = get(klass, 'resourceName');
      return adapter.pluralize(this.keyForResourceName(resourceName));
    }
    return null;
  },
  /*
   * keyForResourceName: helper to transform resource name to valid json key
   */
  keyForResourceName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /*
   * keyForAttributeName: helper to transform attribute name to valid json key
   */
  keyForAttributeName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /*
   * attributeNameForKey: returns ember property name based on json key
   */
  attributeNameForKey: function(resource, key) {
    // check if a custom key was configured for this property
    var modelConfig = get(RESTless, 'client._modelConfigs').get(resource.constructor.toString());
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[key]) {
      return modelConfig.propertyKeys[key];
    }
    return Ember.String.camelize(key);
  },

  /* 
   * prepareData: json must be stringified before transmitting to most backends
   */
  prepareData: function(data) {
    return JSON.stringify(data);
  },
  /* 
   * parseError: transform error response text into json
   */
  parseError: function(error) {
    var errorData = null;
    try { errorData = JSON.parse(error); } catch(e){}
    return errorData;
  },
  /*
   * extractMeta: attempts to extract metadata on json responses
   */
  extractMeta: function(json) {
    if(json && json.meta) {
      return json.meta;
    }
  },
  /*
   * registerTransform: adds a custom tranform to JSONTransforms
   */
  registerTransform: function(type, transform) {
    RESTless.JSONTransforms[type] = transform;
  }
});

/*
 * JSONTransforms
 * Hash for custom json transforms
 * Bulding with json_transforms.js is optional, and will overwrite this
 */
RESTless.JSONTransforms = {};
/*
 * Adapter
 * Base adapter to be subclassed.
 * Handles fetching and saving data to a persistence layer
 * and storing cofiguration options about all models.
 */
RESTless.Adapter = Ember.Object.extend({
  /*
   * serializer: Instance of a Serializer used to transform data
   * i.e. JSONSerializer
   */
  serializer: null,

  /* 
   * Common adapter methods to be implemented in a subclass
   */
  saveRecord:           Ember.K,
  deleteRecord:         Ember.K,
  findAll:              Ember.K,
  findQuery:            Ember.K,
  findByKey:            Ember.K,
  generateIdForRecord:  Ember.K,

  /*
   * find: a convenience method that can be used
   * to intelligently route to findAll/findQuery/findByKey based on its params
   */
  find: function(klass, params) {
    var primaryKey = get(klass, 'primaryKey'),
        singleResourceRequest = typeof params === 'string' || typeof params === 'number' ||
                                (typeof params === 'object' && params.hasOwnProperty(primaryKey));
    if(singleResourceRequest) {
      if(!params.hasOwnProperty(primaryKey)) {
        return this.findByKey(klass, params);
      }
      var key = params[primaryKey];  
      delete params[primaryKey];
      return this.findByKey(klass, key, params);
    } else {
      return this.findQuery(klass, params);
    }
  },

  /*
   * fetch: wraps find method in a promise for async find support
   */
  fetch: function(klass, params) {
    var adapter = this, find;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      find = adapter.find(klass, params);
      find.one('didLoad', function(model) {
        resolve(model);
      });
      find.one('becameError', function(error) {
        reject(error);
      });
    });
  },

  /*
   * reloadRecord: refreshes existing record from the data store
   */
  reloadRecord: function(record) {
    var klass = record.constructor,
        primaryKey = get(klass, 'primaryKey'),
        key = record.get(primaryKey);

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(Ember.isNone(key)) {
      return new Ember.RSVP.Promise(function(resolve, reject){
        reject(null);
      });
    }

    return this.fetch(klass, key);
  },

  /*
   * configurations: stores info about custom configurations
   * plurals - i.e. to set the plural resource name of 'person' to 'people'
   * models - to set a different primary key for a certain model type
   */
  configurations: Ember.Object.create({
    plurals: Ember.Object.create(),
    models: Ember.Map.create()
  }),

  /*
   * configure: helper method to set allowed configurations
   */
  configure: function(type, value) {
    var configs = this.get('configurations'),
        configForType = configs.get(type);
    if(configForType) {
      configs.set(type, Ember.merge(configForType, value));
    }
    return this;
  },

  /*
   * map: helper to map configurations for model types
   * examples:
   * App.Adapter.map('App.Post', { primaryKey: 'slug' });
   * App.Adapter.map('App.Person', { lastName: { key: 'lastNameOfPerson' } });
   */
  map: function(modelKey, config) {
    var modelMap = this.get('configurations.models'),
        modelConfig = modelMap.get(modelKey), 
        newConfig = {},
        configKey, propertyKeys, modifiedPropKey;

    for(configKey in config) {
      if(config.hasOwnProperty(configKey)) {
        if(config[configKey].hasOwnProperty('key')) {
          // If trying to set a custom property key
          // Transform and merge into a custom 'propertyKeys' hash to make lookup faster when deserializing
          propertyKeys = modelConfig && modelConfig.hasOwnProperty('propertyKeys') ? modelConfig.propertyKeys : {};
          modifiedPropKey = config[configKey].key;
          propertyKeys[modifiedPropKey] = configKey;
          newConfig.propertyKeys = propertyKeys;
        } else {
          newConfig[configKey] = config[configKey];
        }
        modelConfig = modelConfig ? Ember.merge(modelConfig, newConfig) : newConfig;
      }
    }
    modelMap.set(modelKey, modelConfig);
    return this;
  },

  /*
   * pluralize: helper to pluralize model resource names.
   * Checks custom configs or simply appends a 's'
   */
  pluralize: function(resourceName) {
    var plurals = this.get('configurations.plurals');
    return (plurals && plurals[resourceName]) || resourceName + 's';
  }
});

/*
 * RESTAdapter
 * Builds REST urls to resources
 * Builds and handles remote ajax requests
 */
RESTless.RESTAdapter = RESTless.Adapter.extend({
  /*
   * serializer: default to a JSON serializer
   */
  serializer: RESTless.JSONSerializer.create(),

  /*
   * url: base url of backend REST service
   * example: 'https://api.example.com'
   */
  url: null,
  /*
   * namespace: endpoint path
   * example: 'api/v1'
   */
  namespace: null,
  /*
   * useContentTypeExtension: forces content type extensions on resource requests
   * i.e. /posts.json vs /posts | /posts/115.json vs /posts/115
   * Useful for conforming to 3rd party apis
   * or returning correct content-type headers with Rails caching
   */
  useContentTypeExtension: false,

  /*
   * rootPath: computed path based on url and namespace
   */
  rootPath: Ember.computed(function() {
    var a = document.createElement('a'),
        url = this.get('url'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = url ? url : '';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href.replace(/\/+$/, '');
  }).property('url', 'namespace'),

  /*
   * resourcePath: helper method creates a valid REST path to a resource
   * App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return this.pluralize(Ember.String.decamelize(resourceName));
  },

  /*
   * request: creates and executes an ajax request wrapped in a promise
   */
  request: function(model, params, key) {
    var adapter = this, serializer = this.serializer;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      params = params || {};
      params.url = adapter.buildUrl(model, key);
      params.dataType = serializer.dataType;
      params.contentType = serializer.contentType;

      if(params.data && params.type !== 'GET') {
        params.data = serializer.prepareData(params.data);
      }

      params.success = function(data, textStatus, jqXHR) {
        Ember.run(null, resolve, data);
      };
      params.error = function(jqXHR, textStatus, errorThrown) {
        var errors = adapter.parseAjaxErrors(jqXHR, textStatus, errorThrown);
        Ember.run(null, reject, errors);
      };

      var ajax = Ember.$.ajax(params);

      // (private) store current ajax request on the model.
      model.set('currentRequest', ajax);
    });
  },

  /*
   * buildUrl (private): constructs request url and dynamically adds the a resource key if specified
   */
  buildUrl: function(model, key) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath],
        dataType = this.get('serializer.dataType'), url;

    if(key) {
      urlParts.push(key);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }

    url = urlParts.join('/');
    if(this.get('useContentTypeExtension') && dataType) {
      url += '.' + dataType;
    }
    return url;
  },

  /*
   * saveRecord: POSTs a new record, or PUTs an updated record to REST service
   */
  saveRecord: function(record) {
    var isNew = record.get('isNew'), method, ajaxPromise;
    //If an existing model isn't dirty, no need to save.
    if(!isNew && !record.get('isDirty')) {
      return new Ember.RSVP.Promise(function(resolve, reject){
        resolve(record);
      });
    }

    record.set('isSaving', true);
    method = isNew ? 'POST' : 'PUT';
    ajaxPromise = this.request(record, { type: method, data: record.serialize() });

    ajaxPromise.then(function(data){
      if(data) {
        record.deserialize(data);
      }
      record.onSaved(isNew);
      return record;
    }, function(error) {
      record.onError(error);
      return error;
    });

    return ajaxPromise;
  },

  deleteRecord: function(record) {
    var ajaxPromise = this.request(record, { type: 'DELETE', data: record.serialize() });

    ajaxPromise.then(function() {
      record.onDeleted();
      return null;
    }, function(error) {
      record.onError(error);
      return error;
    });

    return ajaxPromise;
  },

  reloadRecord: function(record) {
    var klass = record.constructor,
        primaryKey = get(klass, 'primaryKey'),
        key = record.get(primaryKey), ajaxPromise;

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(Ember.isNone(key)) {
      return new Ember.RSVP.Promise(function(resolve, reject){
        reject(null);
      });
    }

    record.set('isLoaded', false);
    ajaxPromise = this.request(record, { type: 'GET' }, key);
    ajaxPromise.then(function(data){
      record.deserialize(data);
      record.onLoaded();
    }, function(error) {
      record.onError(error);
    });

    return ajaxPromise;
  },

  findAll: function(klass) {
    return this.findQuery(klass);
  },

  findQuery: function(klass, queryParams) {
    var type = klass.toString(),
        resourceInstance = klass.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent(),
        ajaxPromise = this.request(resourceInstance, { type: 'GET', data: queryParams });

    ajaxPromise.then(function(data){
      result.deserializeMany(type, data);
      result.onLoaded();
    }, function(error) {
      result.onError(error);
    });

    return result;
  },

  findByKey: function(klass, key, queryParams) {
    var result = klass.create({ isNew: false }),
        ajaxPromise = this.request(result, { type: 'GET', data: queryParams }, key);

    ajaxPromise.then(function(data){
      result.deserialize(data);
      result.onLoaded();
    }, function(error) {
      result.onError(error);
    });

    return result;
  },

  /*
   * fetch: wraps find method in a promise for async find support
   * Overridden to add currentRequest
   */
  fetch: function(klass, params) {
    var adapter = this, find, promise;
    promise = new Ember.RSVP.Promise(function(resolve, reject) {
      find = adapter.find(klass, params);
      find.one('didLoad', function(model) {
        resolve(model);
      });
      find.one('becameError', function(error) {
        reject(error);
      });
    });
    // private: store the ajax request for aborting, etc.
    promise._currentRequest = find.get('currentRequest');
    return promise;
  },

  /*
   * parseAjaxErrors: builds a robust error object using the serializer and xhr data
   */
  parseAjaxErrors: function(jqXHR, textStatus, errorThrown) {
    // use serializer to parse error messages from server
    var errors = this.get('serializer').parseError(jqXHR.responseText) || {};
    // add additional xhr error info
    errors.status = jqXHR.status;
    errors.state = jqXHR.state();
    errors.textStatus = textStatus;
    errors.errorThrown = errorThrown;
    return errors;
  },

  /*
   * registerTransform: fowards custom tranform creation to serializer
   */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  }
});

/**
 * Client
 * You can define a custom Client on your app like you would DS.Store in ember-data.
 * The client will be automatically detected and set from your App namespace.
 * Setting a Client is optional and will automatically use a base Client.
 *
 * @class Client
 * @namespace RESTless
 * @extends Ember.Object
 */
RESTless.Client = Ember.Object.extend({
  adapter: RESTless.RESTAdapter.create(),
  // Private shortcut aliases:
  _modelConfigs: Ember.computed.alias('adapter.configurations.models')
});

Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'Client',
    initialize: function(container, application) {
      // On app initialize, if custom Client is present,
      // set that as the default client
      if(application.Client) {
        RESTless.set('client', application.Client);
      } else {
        // Set a default client
        RESTless.set('client', RESTless.Client.create());
      }
      // Add an observer so you can set a client at a later date
      application.addObserver('Client', this, function() {
        RESTless.set('client', this.Client);
      });
    }
  });
});

/*
 * State
 * Mixin for managing model lifecycle state
 */
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /*
   * isNew: model has not yet been saved.
   */
  isNew: true,
  /* 
   * isLoaded: model has been retrieved
   */
  isLoaded: false,
  /* 
   * isDirty: model has changes that have not yet been saved
   */
  isDirty: false,
  /* 
   * isSaving: model is in the process of saving
   */
  isSaving: false,
  /* 
   * isError: model has been marked as invalid after response from adapter
   */
  isError: false,
  /*
   * _isReady (private)
   * Flag for deferring dirty state when setting initial values on create() or load()
   */
  _isReady: false,
  /* 
   * errors: error data returned from adapter
   */
  errors: null,

  /*
   * State event hooks
   */
  didCreate:    Ember.K,
  didUpdate:    Ember.K,
  didLoad:      Ember.K,
  didDelete:    Ember.K,
  becameError:  Ember.K,

  /*
   * Internal state change handlers, called by adapter
   */
  onSaved: function(wasNew) {
    this.setProperties({
      isDirty: false,
      isSaving: false,
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent(wasNew ? 'didCreate' : 'didUpdate', this);
    this._triggerEvent('didLoad', this);
  },

  onDeleted: function() {
    this._triggerEvent('didDelete', this);
    Ember.run.next(this, function() {
      this.destroy();
    });
  },

  onLoaded: function() {
    this.setProperties({
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent('didLoad', this);
  },

  onError: function(errors) {
    this.setProperties({
      isSaving: false,
      isError: true,
      errors: errors
    });
    this._triggerEvent('becameError', errors);
  },

  /* 
   * clearErrors: (helper) reset isError flag, clear error messages
   */
  clearErrors: function() {
    this.setProperties({ isError: false, errors: null });
    return this;
  },

  /* 
   * copyState: copies the current state to a cloned object
   */
  copyState: function(clone) {
    var mi = RESTless.State.mixins,
        props = mi[mi.length-1].properties;
    Ember.beginPropertyChanges(clone);
    for(var p in props) { 
      if(props.hasOwnProperty(p) && typeof props[p] !== 'function') {
        clone.set(p, this.get(p));
      }
    }
    Ember.endPropertyChanges(clone);
    return clone;
  },

  _triggerEvent: function(event, data) {
    Ember.run(this, function() {
      Ember.tryInvoke(this, event, [data]);
      this.trigger(event, data);
    });
  }
});

/**
 * Model
 * Base model class for all records
 *
 * @class Model
 * @namespace RESTless
 * @extends Ember.Object
 * @constructor
 */
RESTless.Model = Ember.Object.extend( RESTless.State, Ember.Copyable, {
  /** 
   * id: unique id number, default primary id
   *
   * @property {RESTless.attr}
   */
  id: RESTless.attr('number'),

  /**
   * _data: Stores raw model data. Don't use directly; use declared model attributes.
   *
   * @private
   * @property {Object}
   */
  __data: null,
  _data: Ember.computed(function() {
    if (!this.__data) { this.__data = {}; }
    return this.__data;
  }),

  /** 
   * didDefineProperty: Hook to add observers for each attribute/relationship for 'isDirty' functionality
   */
  didDefineProperty: function(proto, key, value) {
    if (value instanceof Ember.Descriptor) {
      var meta = value.meta();

      if (meta.isRelationship && !meta.readOnly) {
        // If a relationship's property becomes dirty, need to mark owner as dirty.
        Ember.addObserver(proto, key + '.isDirty', null, '_onRelationshipChange');
      }
    }
  },

  /**
   * _onPropertyChange: called when any property of the model changes
   * If the model has been loaded, or is new, isDirty flag is set to true.
   * @private
   */
  _onPropertyChange: function(key) {
    var isNew = this.get('isNew');

    // No longer a new record once a primary key is assigned.
    if (isNew && get(this.constructor, 'primaryKey') === key) {
      this.set('isNew', false);
      isNew = false;
    }

    if (this.get('_isReady') && (isNew || this.get('isLoaded'))) {
      this.set('isDirty', true);
    }
  },
  /**
   * _onRelationshipChange: called when a relationship property's isDirty state changes
   * Forwards a _onPropertyChange event for the parent object
   * @private
   */
  _onRelationshipChange: function(sender, key) {
    if(sender.get(key)) { // if isDirty
      this._onPropertyChange(key);
    }
  },

  /**
   * copy: creates a copy of the object. Implements Ember.Copyable protocol
   * http://emberjs.com/api/classes/Ember.Copyable.html#method_copy
   */
  copy: function(deep) {
    var clone = this.constructor.create(),
        fields = get(this.constructor, 'fields');

    Ember.beginPropertyChanges(this);
    fields.forEach(function(field, opts) {
      var value = this.get(field);
      if (value !== null) {
        clone.set(field, value);
      }
    }, this);
    Ember.endPropertyChanges(this);

    return clone;
  },
  /* 
   * copyWithState: creates a copy of the object along with the RESTless.State properties
   */
  copyWithState: function(deep) {
    return this.copyState(this.copy(deep));
  },

  /*
   * create/update/delete methods
   * Forward to the current adapter to perform operations on persistance layer
   */
  saveRecord: function() {
    return get(this.constructor, 'adapter').saveRecord(this);
  },
  deleteRecord: function() {
    return get(this.constructor, 'adapter').deleteRecord(this);
  },
  reloadRecord: function() {
    return get(this.constructor, 'adapter').reloadRecord(this);
  },

  /* 
   * serialization methods: Transforms model to and from its data representation.
   * Forward to the current serializer to perform appropriate parsing
   */
  serialize: function(options) {
    return RESTless.get('client.adapter.serializer').serialize(this, options);
  },
  deserialize: function(data) {
    return RESTless.get('client.adapter.serializer').deserialize(this, data);
  },
  serializeProperty: function(prop) {
    return RESTless.get('client.adapter.serializer').serializeProperty(this, prop);
  },
  deserializeProperty: function(prop, value) {
    return RESTless.get('client.adapter.serializer').deserializeProperty(this, prop, value);
  }
});

/*
 * RESTless.Model (static)
 * Class level properties and methods
 */
RESTless.Model.reopenClass({
  /*
   * create: standard super class create, then marks _isReady state flag
   */
  create: function() {
    var instance = this._super.apply(this, arguments);
    instance.set('_isReady', true);
    return instance;
  },
  /*
   * createRecord: alias to create.  Ease transition to/from ember-data
   */
  createRecord: Ember.aliasMethod('create'),

  /*
   * adapter: hook to override which adapter instance to use per model
   */
  adapter: Ember.computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /* 
   * primaryKey: property name for the primary key.
   * Configurable. Defaults to 'id'.
   */
  primaryKey: Ember.computed(function() {
    var className = this.toString(),
        modelConfig = get(RESTless, 'client._modelConfigs').get(className);
    if(modelConfig && modelConfig.primaryKey) {
      return modelConfig.primaryKey;
    }
    return 'id';
  }).property('RESTless.client._modelConfigs'),

  /*
   * resourceName: helper to extract name of model subclass
   * App.Post => 'Post', App.PostGroup => 'PostGroup', App.AnotherNamespace.Post => 'Post'
   */
  resourceName: Ember.computed(function() {
    var classNameParts = this.toString().split('.');
    return classNameParts[classNameParts.length-1];
  }),

  /*
   * fields: meta information for all attributes and relationships
   */
  fields: Ember.computed(function() {
    var map = Ember.Map.create();
    this.eachComputedProperty(function(name, meta) {
      if (meta.isAttribute || meta.isRelationship) {
        map.set(name, meta);
      }
    });
    return map;
  }),

  /*
   * find methods: retrieve model(s) with specified params
   * Forwards to the current adapter to retrieve from the appropriate data layer
   */
  find: function(params) {
    return get(this, 'adapter').find(this, params);
  },
  fetch: function(params) {
    return get(this, 'adapter').fetch(this, params);
  },
  findAll: function() {
    return get(this, 'adapter').findAll(this);
  },
  findQuery: function(params) {
    return get(this, 'adapter').findQuery(this, params);
  },
  findByKey: function(key, params) {
    return get(this, 'adapter').findByKey(this, key, params);
  },
  /*
   * findById: alias to findByKey method
   * Keeps api inline with ember-data.
   * A model's primary key can be customized so findById is not always semantically correct.
   */
  findById: Ember.aliasMethod('findByKey'),

  /*
   * load: Create model directly from data representation.
   */
  load: function(data) {
    var model = this.create().set('_isReady', false).deserialize(data).set('_isReady', true);
    model.onLoaded();
    return model;
  },
  /*
   * loadMany: Create collection of records directly from data representation.
   */
  loadMany: function(data) {
    var array = RESTless.RecordArray.createWithContent().deserializeMany(this.toString(), data);
    array.onLoaded();
    return array;
  }
});

/*
 * ReadOnlyModel
 * Subclass for models that are read-only.
 * Removes property change observers and write methods.
 * Helps improve performance when write functionality is not needed.
 */
RESTless.ReadOnlyModel = RESTless.Model.extend({
  /*
   * Remove functionality associated with writing data and keeping state
   */
  serialize: null,
  saveRecord: null,
  deleteRecord: null,
  didDefineProperty: null,
  _onPropertyChange: Ember.K
});

/*
 * RecordArray
 * Base class extention for arrays of Models
 */
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * adapter: hook for overriding the record array adapter
   */
  adapter: Ember.computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /* 
   * deserializeMany: use the current Serializer turn the data into a record array
   */
  deserializeMany: function(type, data) {
    return get(this, 'adapter.serializer').deserializeMany(this, type, data);
  },
  /* 
   * serializeMany: use the current Serializer turn the array into data representation
   */
  serializeMany: function(type) {
    return get(this, 'adapter.serializer').serializeMany(this, type);
  },

  /*
   * replaceContent: Changes array contents. Overriden to mark RecordArray as
   * dirty if loaded.
   */
  replaceContent: function(idx, amt, objects) {
    get(this, 'content').replace(idx, amt, objects);
    if (this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  },

  /*
   * _onItemDirtyChange: (private) observes when items become dirty
   */
  _onItemDirtyChange: Ember.observer(function() {
    var clean = this.get('content').everyProperty('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }, '@each.isDirty'),

  /*
   * _onLoadedChange: (private) observes when the array's isLoaded state changes
   * and triggers each items onLoaded
   */
  _onLoadedChange: Ember.observer(function() {
    if(this.get('isLoaded')) {
      this.forEach(function(item) {
        if(RESTless.Model.detectInstance(item)) {
          item.onLoaded();
        }
      });
    }
  }, 'isLoaded')
});

/*
 * RecordArray (static)
 */
RESTless.RecordArray.reopenClass({
  /*
   * create: override state property defaults not implemented or applicable to arrays
   */
  create: function() {
    var arr = this._super.apply(this, arguments);
    return arr.setProperties({ _isReady: true, isNew: false });
  },
  /*
   * createWithContent: helper to create a RecordArray with the content property initialized
   */
  createWithContent: function() {
    var arr = this.create.apply(this, arguments);
    if(!arr.content) { arr.set('content', Ember.A()); }
    return arr;
  }
});

/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * © 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 *
 * From ember-data:
 * https://github.com/emberjs/data/blob/master/packages/ember-data/lib/ext/date.js
 */

Ember.Date = Ember.Date || {};

var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
Ember.Date.parse = function (date) {
    var timestamp, struct, minutesOffset = 0;

    // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
    // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
    // implementations could be faster
    //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
    if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
        // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
        for (var i = 0, k; (k = numericKeys[i]); ++i) {
            struct[k] = +struct[k] || 0;
        }

        // allow undefined days and months
        struct[2] = (+struct[2] || 1) - 1;
        struct[3] = +struct[3] || 1;

        if (struct[8] !== 'Z' && struct[9] !== undefined) {
            minutesOffset = struct[10] * 60 + struct[11];

            if (struct[9] === '+') {
                minutesOffset = 0 - minutesOffset;
            }
        }

        timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
    }
    else {
        timestamp = origParse ? origParse(date) : NaN;
    }

    return timestamp;
};

if (Ember.EXTEND_PROTOTYPES === true || Ember.EXTEND_PROTOTYPES.Date) {
  Date.parse = Ember.Date.parse;
}

/**
 * From ember-data:
 * https://github.com/emberjs/data/blob/master/packages/ember-data/lib/transforms/json_transforms.js
 */

var isNone = Ember.isNone, isEmpty = Ember.isEmpty;

/**
  @class JSONTransforms
  @static
  @namespace RESTless
*/
RESTless.JSONTransforms = {
  string: {
    deserialize: function(serialized) {
      return isNone(serialized) ? null : String(serialized);
    },

    serialize: function(deserialized) {
      return isNone(deserialized) ? null : String(deserialized);
    }
  },

  number: {
    deserialize: function(serialized) {
      return isEmpty(serialized) ? null : Number(serialized);
    },

    serialize: function(deserialized) {
      return isEmpty(deserialized) ? null : Number(deserialized);
    }
  },

  // Handles the following boolean inputs:
  // "TrUe", "t", "f", "FALSE", 0, (non-zero), or boolean true/false
  'boolean': {
    deserialize: function(serialized) {
      var type = typeof serialized;

      if (type === "boolean") {
        return serialized;
      } else if (type === "string") {
        return serialized.match(/^true$|^t$|^1$/i) !== null;
      } else if (type === "number") {
        return serialized === 1;
      } else {
        return false;
      }
    },

    serialize: function(deserialized) {
      return Boolean(deserialized);
    }
  },

  date: {
    deserialize: function(serialized) {
      var type = typeof serialized;

      if (type === "string") {
        return new Date(Ember.Date.parse(serialized));
      } else if (type === "number") {
        return new Date(serialized);
      } else if (serialized === null || serialized === undefined) {
        // if the value is not present in the data,
        // return undefined, not null.
        return serialized;
      } else {
        return null;
      }
    },

    serialize: function(date) {
      if (date instanceof Date) {
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        var pad = function(num) {
          return num < 10 ? "0"+num : ""+num;
        };

        var utcYear = date.getUTCFullYear(),
            utcMonth = date.getUTCMonth(),
            utcDayOfMonth = date.getUTCDate(),
            utcDay = date.getUTCDay(),
            utcHours = date.getUTCHours(),
            utcMinutes = date.getUTCMinutes(),
            utcSeconds = date.getUTCSeconds();


        var dayOfWeek = days[utcDay];
        var dayOfMonth = pad(utcDayOfMonth);
        var month = months[utcMonth];

        return dayOfWeek + ", " + dayOfMonth + " " + month + " " + utcYear + " " +
               pad(utcHours) + ":" + pad(utcMinutes) + ":" + pad(utcSeconds) + " GMT";
      } else {
        return null;
      }
    }
  }
};

})(this, jQuery, Ember);