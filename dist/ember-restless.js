/**
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.2.2
 * last modifed: 2013-06-05
 *
 * Garth Poitras <garth22@gmail.com>
 * Copyright (c) 2013 Endless, Inc.
 */

(function(window, $, Ember, undefined){

"use strict";

var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

function requiredMethod(name) {
  return function() { throw new Ember.Error(this.constructor.toString() + " must implement the required method: " + name); };
}

if (RESTless === undefined) {
  /**
   * Create RESTless as an Ember Namespace.
   * Track version and API revision number.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.2.2',
    CURRENT_API_REVISION: 2
  });

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
  var meta = $.extend({ type: type, isAttribute: true }, opts);
  return makeComputedAttribute(meta);
};

// belongsTo: One-to-one relationships
RESTless.belongsTo = function(type, opts) {
  var defaultRecord = function() {
    return get(Ember.lookup, type).create();
  },
  meta = $.extend({ type: type, isRelationship: true, belongsTo: true, defaultValue: defaultRecord }, opts);
  return makeComputedAttribute(meta);
};

// hasMany: One-to-many & many-to-many relationships
RESTless.hasMany = function(type, opts) {
  var defaultArray = function() {
    return RESTless.RecordArray.createWithContent({type: type});
  },
  meta = $.extend({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
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
   * Common serializer methods that must be implemented in a subclass
   */
  deserialize:         requiredMethod('deserialize'),
  deserializeProperty: requiredMethod('deserializeProperty'),
  deserializeMany:     requiredMethod('deserializeMany'),
  serialize:           requiredMethod('serialize'),
  serializeProperty:   requiredMethod('serializeProperty'),
  serializeMany:       requiredMethod('serializeMany'),

  /*
   * prepareData: (optional override) preps data before persisting
   */
  prepareData: function(data) {
    return data;
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
   * deserialize: translates json object into a model. i.e:
   * { id:1, name:'post 1' } => App.Post
   */
  deserialize: function(resource, data) {
    // Check if data is wrapped (ActiveRecord): { post: { id:1, name:'post 1' } }
    var key = this._keyForResource(resource), prop;
    if(data[key]) {
      data = data[key];
    }

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
    var modelConfig = get(RESTless, 'client._modelConfigs').get(resource.constructor.toString()), formattedProp;
 
    // check if a custom key was configured for this property
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[prop]) {
      formattedProp = modelConfig.propertyKeys[prop];
    } else {
      formattedProp = Ember.String.camelize(prop);
    }

    var fields = get(resource.constructor, 'fields'),
        field = fields.get(formattedProp);

    // If the json contains a key not defined on the model, don't attempt to set it.
    if (!field) { return; }

    // If property is a hasMany relationship, deserialze the array
    if (field.hasMany) {
      var hasManyArr = this.deserializeMany(resource.get(formattedProp), field.type, value);
      resource.set(formattedProp, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if (field.belongsTo) {
      var belongsToModel = get(Ember.lookup, field.type).create({ isNew: false });
      this.deserialize(belongsToModel, value);
      resource.set(formattedProp, belongsToModel);
      belongsToModel.set('isLoaded', true);
    }
    else {
      // Check for a custom transform
      if (field.type && RESTless.JSONTransforms[field.type]) {
        value = RESTless.JSONTransforms[field.type].deserialize(value);
      }
      resource.set(formattedProp, value);
    }
  },

  /* 
   * deserializeMany: deserializes an array of json objects
   */
  deserializeMany: function(resource, type, data) {
    // extract any meta info
    var meta = this.extractMeta(data);
    if(meta) { resource.set('meta', meta); }

    // findAll from ActiveRecord returns array wrapped in plural resource name: { posts: [...] }
    if(!$.isArray(data)) {
      var keyPlural = get(RESTless, 'client.adapter').pluralize(this._keyForResourceType(type));
      data = data[keyPlural];
    }
    if(!data) { 
      return; 
    }

    var len = data.length,
        resourceArr = [], item, i;
    if(resource) {
      resource.clear();
    } else {
      resource = RESTless.RecordArray.createWithContent({type: type});
    }
    for(i=0; i<len; i++) {
      item = get(Ember.lookup, type).create({ isNew: false }).deserialize(data[i]);
      resourceArr.push(item);
    }
    if(resourceArr.length) {
      resource.pushObjects(resourceArr);
    }

    resource.set('isLoaded', true);

    return resource;
  },

  /* 
   * serialize: turns model into json
   */
  serialize: function(resource) {
    var key = this._keyForResource(resource),
        fields = get(resource.constructor, 'fields'),
        json = {};

    json[key] = {};
    fields.forEach(function(field, opts) {
      //Don't include readOnly properties or to-one relationships
      if (!opts.readOnly && !opts.belongsTo) {
        var val = this.serializeProperty(resource, field, opts);
        if(val !== null) {
          json[key][this.keyForAttributeName(field)] = val;
        }
      }
    }, this);

    return json;
  },

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop, opts) {
    var value = resource.get(prop);

    if (!opts) {
      opts = resource.constructor.metaForProperty(prop);
    }

    if (opts.hasMany) {
      return this.serializeMany(value.get('content'), opts.type);
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
  serializeMany: function(resourceArr, type) {
    var key = this._keyForResourceType(type),
        result = [],
        len = resourceArr.length, i, item;
    for(i=0; i<len; i++) {
      item = resourceArr[i].serialize();
      result.push(item[key]);
    }
    return result;
  },

  /*
   * _keyForResource, _keyForResourceType (private) shortcut helpers
   */
  _keyForResource: function(resource) {
    return this.keyForResourceName(get(resource.constructor, 'resourceName'));
  },
  _keyForResourceType: function(type) {
    return this._keyForResource(get(Ember.lookup, type).create());
  },

  /*
   * keyForResourceName: helper to transform resource name to valid json key
   */
  keyForResourceName: function(name) {
    return Ember.String.decamelize(name);
  },
  /*
   * keyForAttributeName: helper to transform attribute name to valid json key
   */
  keyForAttributeName: function(name) {
    return Ember.String.decamelize(name);
  },
  /* 
   * prepareData: json must be stringified before transmitting to most backends
   */
  prepareData: function(data) {
    return JSON.stringify(data);
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
   * Common adapter methods that must be implemented in a subclass
   */
  saveRecord:   requiredMethod('saveRecord'),
  deleteRecord: requiredMethod('deleteRecord'),
  find:         requiredMethod('find'),
  findAll:      requiredMethod('findAll'),

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
      configs.set(type, $.extend(configForType, value));
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
        modelConfig = $.extend(modelConfig, newConfig);
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
    return a.href;
  }).property('url', 'namespace'),

  /*
   * resourcePath: helper method creates a valid REST path to a resource
   * App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return Ember.String.decamelize(this.pluralize(resourceName));
  },

  /*
   * request: a wrapper around jQuery's ajax method
   * builds the url and dynamically adds the a resource key if specified
   */
  request: function(model, params, resourceKey) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath];

    if(resourceKey) {
      urlParts.push(resourceKey);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }
    params.url = urlParts.join('/');
    params.dataType = this.get('serializer.dataType');
    params.contentType = this.get('serializer.contentType');

    if(params.data && params.type !== 'GET') {
      params.data = this.get('serializer').prepareData(params.data);
    }

    var request = $.ajax(params);
    // Store a reference to the active request and destroy it when finished
    model.set('currentRequest', request);
    request.always(function() {
      model.set('currentRequest', null);
    });
    return request;
  },

  /*
   * saveRecord: POSTs a new record, or PUTs an updated record to REST service
   */
  saveRecord: function(record) {
    //If an existing model isn't dirty, no need to save.
    if(!record.get('isNew') && !record.get('isDirty')) {
      return $.Deferred().resolve();
    }
    record.set('isSaving', true);

    var isNew = record.get('isNew'), // purposely cache value for triggering correct event later
        method = isNew ? 'POST' : 'PUT',
        saveRequest = this.request(record, { type: method, data: record.serialize() }),
        self = this;

    saveRequest.done(function(data){
      if (data) {    // 204 No Content responses send no body
        record.deserialize(data);
      }
      record.clearErrors();
      record.set('isDirty', false);
      record._triggerEvent(isNew ? 'didCreate' : 'didUpdate');
    })
    .fail(function(jqxhr) {
      self._onError(record, jqxhr.responseText);
    })
    .always(function() {
      record.set('isSaving', false);
      record.set('isLoaded', true);
      record._triggerEvent('didLoad');
    });
    return saveRequest;
  },

  deleteRecord: function(record) {
    var deleteRequest = this.request(record, { type: 'DELETE', data: record.serialize() }),
        self = this;

    deleteRequest.done(function(){
      record._triggerEvent('didDelete');
      record.destroy();
    })
    .fail(function(jqxhr) {
      self._onError(record, jqxhr.responseText);
    });
    return deleteRequest;
  },

  find: function(model, params) {
    var primaryKey = get(model, 'primaryKey'),
        singleResourceRequest = typeof params === 'string' || typeof params === 'number' ||
                                (typeof params === 'object' && params.hasOwnProperty(primaryKey)), key;
    if(singleResourceRequest) {
      key = params.hasOwnProperty(primaryKey) ? params[primaryKey] : params;
      return this.findByKey(model, key);
    } else {
      return this.findAll(model, params);
    }
  },

  findAll: function(model, params) {
    var resourceInstance = model.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent({ type: model.toString() }),
        findRequest = this.request(resourceInstance, { type: 'GET', data: params }),
        self = this;

    findRequest.done(function(data){
      result.deserializeMany(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      self._onError(result, jqxhr.responseText);
    })
    .always(function() {
      result.set('isLoaded', true);
      result._triggerEvent('didLoad');
    });
    return result;
  },

  findByKey: function(model, key) {
    var result = model.create({ isNew: false }),
        findRequest = this.request(result, { type: 'GET' }, key),
        self = this;

    findRequest.done(function(data){
      result.deserialize(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      self._onError(result, jqxhr.responseText);
    })
    .always(function() {
      result.set('isLoaded', true);
      result._triggerEvent('didLoad');
    });
    return result;
  },

  /*
   * registerTransform: fowards custom tranform creation to serializer
   */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  },

  /* 
   * _onError: (private) helper method for handling error responses
   * Parses error json, sets error properties, and triggers error events
   */
  _onError: function(model, errorResponse) {
    var errorData = null;
    try { errorData = $.parseJSON(errorResponse); } catch(e){}
    model.setProperties({ 'isError': true, 'errors': errorData });
    model._triggerEvent('becameError');
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
  revision: RESTless.CURRENT_API_REVISION,
  adapter: RESTless.RESTAdapter.create(),
  // Private shortcut aliases:
  _configs: Ember.computed.alias('adapter.configurations'),
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

/* Deprecate warning for RESTClient, since it is a crucial first step for customization */
RESTless.RESTClient = RESTless.Client.extend({
  init: function() {
    Ember.deprecate("RESTClient is deprecated. Please use Client instead.");
    this._super();
  }
});

/*
 * State
 * Mixin for managing model lifecycle state
 */
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /* 
   * isLoaded: model has retrived
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
   * errors: error message json returned from REST service
   */
  errors: null,

  /* 
   * clearErrors: (helper) reset isError flag, clear error messages
   */
  clearErrors: function() {
    this.setProperties({ 'isError': false, 'errors': null });
    return this;
  },

  /* 
   * copyState: copies the current state to a cloned object
   */
  copyState: function(clone) {
    return clone.setProperties({
      isLoaded: this.get('isLoaded'),
      isDirty:  this.get('isDirty'),
      isSaving: this.get('isSaving'),
      isError:  this.get('isError'),
      errors:   this.get('errors')
    });
  },

  /* 
   * _triggerEvent: (private) helper method to trigger lifecycle events
   */
  _triggerEvent: function(name) {
    Ember.run(this, function() {
      this.trigger(name, this);
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
   * isNew: model has not yet been saved.
   * When a primary key value is set, isNew becomes false
   *
   * @property {Boolean}
   */
  isNew: true,

  /**
   * _isReady: For internal state management.
   * Model won't be dirtied when setting initial values on create() or load()
   *
   * @private
   * @property {Boolean}
   */
  _isReady: false,

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

      if (meta.isRelationship) {
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
   * saveRecord: save record to persistance layer - forward to adapter
   */
  saveRecord: function() {
    return RESTless.get('client.adapter').saveRecord(this);
  },
  /*
   * deleteRecord: delete record to persistance layer - forward to adapter
   */
  deleteRecord: function() {
    return RESTless.get('client.adapter').deleteRecord(this);
  },
  /* 
   * serialize: use the current Serializer to turn the model into data representation
   */
  serialize: function() {
    return RESTless.get('client.adapter.serializer').serialize(this);
  },
  /* 
   * deserialize: use the current Serializer to set the model properties from supplied data
   */
  deserialize: function(data) {
    return RESTless.get('client.adapter.serializer').deserialize(this, data);
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
   * find: get a model with specified param. Optionally also alias to handle findAll
   */
  find: function(params) {
    return RESTless.get('client.adapter').find(this, params);
  },
  /*
   * findAll: fetches all objects of this type with specified params
   */
  findAll: function(params) {
    return RESTless.get('client.adapter').findAll(this, params);
  },

  /*
   * load: Create model directly from data representation.
   */
  load: function(data) {
    return this.create().set('_isReady', false).deserialize(data).setProperties({ _isReady: true, isLoaded: true });
  },

  /*
   * loadMany: Create collection of records directly from data representation.
   */
  loadMany: function(data) {
    return RESTless.RecordArray.createWithContent({ type: this.toString() })
            .deserializeMany(data)
            .set('isLoaded', true);
  }
});

/*
 * RecordArray
 * Base class extention for arrays of Models
 */
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model class the array contains
   */
  type: null,

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function(opts) {
    var type = this.get('type'),
        itemClass = type ? get(Ember.lookup, type) : Ember.Object;
    this.pushObject(itemClass.create(opts));
  },

  /* 
   * deserializeMany: use the current Serializer to populate the array from supplied data
   */
  deserializeMany: function(data) {
    return RESTless.get('client.adapter.serializer').deserializeMany(this, this.get('type'), data);
  },
  /* 
   * serializeMany: use the current Serializer turn the array into data representation
   */
  serializeMany: function() {
    return RESTless.get('client.adapter.serializer').serializeMany(this, this.get('type'));
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
   * and updates each item's isLoaded to match
   */
  _onLoadedChange: Ember.observer(function() {
    if(this.get('isLoaded')) {
      this.setEach('isLoaded', true);
    }
  }, 'isLoaded')
});

/*
 * RecordArray (static)
 */
RESTless.RecordArray.reopenClass({
  /*
   * createWithContent: helper to create a RecordArray with the content property initialized
   */
  createWithContent: function(opts) {
    return RESTless.RecordArray.create($.extend({ content: Ember.A() }, opts));
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