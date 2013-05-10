/*!
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.2.0
 * last modifed: 2013-05-10
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
  /*
   * Create RESTless as an Ember Namespace.
   * Track version and API revision number.
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.2.0',
    CURRENT_API_REVISION: 2
  });

  /*
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if (window !== undefined) {
    window.RL = window.RESTless = RESTless;
  }
}

/*
 * RESTless._Attribute (private)
 * Stores metadata about model property types
 */
RESTless._Attribute = Ember.ObjectProxy.extend({
  type: null,
  readOnly: false,
  belongsTo: false,
  hasMany: false,
  isRelationship: false
});

/*
 * Public attribute interfaces to define model properties
 */
// Standard property
RESTless.attr = function(type, opts) {
  opts = $.extend({ type: type }, opts);
  return RESTless._Attribute.create(opts);
};

// belongsTo: One-to-one relationship between two models
RESTless.belongsTo = function(type, opts) {
  opts = $.extend({ type: type, belongsTo:true, isRelationship:true }, opts);
  return RESTless._Attribute.create(opts);
};

// hasMany: One-to-many & many-to-many relationships
RESTless.hasMany = function(type, opts) {
  opts = $.extend({ type: type, hasMany:true, isRelationship:true }, opts);
  return RESTless._Attribute.create(opts);
};

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
   * i.e. a RESTAdapter with a JSONSerializer may need to JSON.stringify data before POSTing
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

  prepareData: function(data) {
    return JSON.stringify(data);
  },

  /* 
   * deserialize: translates json object into a model. i.e:
   * { id:1, name:'post 1' }
   */
  deserialize: function(resource, data) {
    // Check if data is wrapped (ActiveRecord): { post: { id:1, name:'post 1' } }
    var resourceName = get(resource.constructor, 'resourceName'), prop;
    if(data[resourceName]) {
      data = data[resourceName];
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
    var formattedProp = prop.camelize(),
          modelConfig = get(RESTless, 'client._modelConfigs').get(resource.constructor.toString());
 
    // check if a custom key was configured for this property
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[formattedProp]) {
      formattedProp = modelConfig.propertyKeys[formattedProp];
    } else if(get(resource, formattedProp) === undefined) {
      // If the json contains a key not defined on the model, don't attempt to set it.
      return;
    }
    var attrMap = get(resource.constructor, 'attributeMap'),
        attr = attrMap[formattedProp],
        attrType = attr.get('type');

    // If property is a hasMany relationship, deserialze the array
    if(attr.get('hasMany')) {
      var hasManyArr = this.deserializeMany(resource.get(formattedProp), attrType, value);
      resource.set(formattedProp, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if(attr.get('belongsTo')) {
      var belongsToModel = get(window, attrType).create();
      this.deserialize(belongsToModel, value);
      resource.set(formattedProp, belongsToModel);
      Ember.run.next(function() {
        belongsToModel.set('isLoaded', true);
      });
    }
    else {
      // Check for a custom transform
      if(attrType && RESTless.JSONTransforms[attrType]) {
        value = RESTless.JSONTransforms[attrType].deserialize(value);
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

    // findAll from ActiveRecord returns { posts: [...] }
    if(!$.isArray(data)) {
      data = data[resource.get('resourceTypeNamePlural')];
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
      item = get(window, type).create().deserialize(data[i]);
      resourceArr.push(item);
    }
    if(resourceArr.length) {
      resource.pushObjects(resourceArr);
    }
    Ember.run.next(function() {
      resource.set('isLoaded', true);
    });
    return resource;
  },

  /* 
   * serialize: turns model into json
   */
  serialize: function(resource) {
    var resourceName = get(resource.constructor, 'resourceName'),
        attrMap = get(resource.constructor, 'attributeMap'),
        json = {}, attr, val;

    json[resourceName] = {};
    for(attr in attrMap) {
      //Don't include readOnly properties or to-one relationships
      if (attrMap.hasOwnProperty(attr) && !attrMap[attr].get('readOnly') && !attrMap[attr].get('belongsTo')) {
        val = this.serializeProperty(resource, attr);
        if(val !== null) {
          json[resourceName][attr.decamelize()] = val;
        }
      }
    }  
    return json;
  },

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop) {
    var value = resource.get(prop),
        attrMap = get(resource.constructor, 'attributeMap'),
        attr = attrMap[prop],
        attrType = attr.get('type');

    if(attr.get('hasMany')) {
      return this.serializeMany(value.get('content'), attrType);
    }

    //Check for a custom transform
    if(attrType && RESTless.JSONTransforms[attrType]) {
      value = RESTless.JSONTransforms[attrType].serialize(value);
    }
    return value;
  },

  /* 
   * serializeMany: serializes an array of models into json
   */
  serializeMany: function(resourceArr, type) {
    var resourceName = get(get(window, type), 'resourceName'),
        result = [],
        len = resourceArr.length, i;
    for(i=0; i<len; i++) {
      var item = resourceArr[i].serialize();
      result.push(item[resourceName]);
    }
    return result;
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
  rootPath: function() {
    var a = document.createElement('a'),
        url = this.get('url'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = url ? url : '';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href;
  }.property('url', 'namespace'),

  /*
   * request: a wrapper around jQuery's ajax method
   * builds the url and dynamically adds the a resource key if specified
   */
  request: function(model, params, resourceKey) {
    var resourceName = get(model.constructor, 'resourceNamePlural'),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourceName];

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
        saveRequest = this.request(record, { type: method, data: record.serialize() });

    saveRequest.done(function(data){
      if (data) {    // 204 No Content responses send no body
        record.deserialize(data);
      }
      record.clearErrors();
      record.set('isDirty', false);
      record._triggerEvent(isNew ? 'didCreate' : 'didUpdate');
    })
    .fail(function(jqxhr) {
      record._onError(jqxhr.responseText);
    })
    .always(function() {
      record.set('isSaving', false);
      record.set('isLoaded', true);
      record._triggerEvent('didLoad');
    });
    return saveRequest;
  },

  deleteRecord: function(record) {
    var deleteRequest = this.request(record, { type: 'DELETE', data: record.serialize() });

    deleteRequest.done(function(){
      record._triggerEvent('didDelete');
      record.destroy();
    })
    .fail(function(jqxhr) {
      record._onError(jqxhr.responseText);
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
    var resourceInstance = model.create(),
        result = RESTless.RecordArray.createWithContent({ type: model.toString() }),
        findRequest = this.request(resourceInstance, { type: 'GET', data: params });

    findRequest.done(function(data){
      result.deserializeMany(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      result._onError(jqxhr.responseText);
    })
    .always(function() {
      result.set('isLoaded', true);
      result._triggerEvent('didLoad');
    });
    return result;
  },

  findByKey: function(model, key) {
    var result = model.create(),
        findRequest = this.request(result, { type: 'GET' }, key);

    findRequest.done(function(data){
      result.deserialize(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      result._onError(jqxhr.responseText);
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
  }
});

/* Client
 * Core interface that houses the current Adapter.
 * You can define a custom Client on your app like you would DS.Store in ember-data.
 * The client will be automatically detected and set from your App namespace.
 * Setting a Client is optional and will automatically use a base Client.
 */
RESTless.Client = Ember.Object.extend({
  revision: RESTless.CURRENT_API_REVISION,
  adapter: RESTless.RESTAdapter.create(),
  // Private shortcut aliases:
  _configs: Ember.computed.alias('adapter.configurations'),
  _pluralConfigs: Ember.computed.alias('adapter.configurations.plurals'),
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
  _triggerEvent: function(name, data) {
    Ember.run(this, function() {
      this.trigger(name, data);
    });
  },

  /* 
   * _onError: (private) helper method for handling error responses
   * Parses error json, sets error properties, and triggers error events
   * TODO: Move to REST/JSON only implementation
   */
  _onError: function(errorResponse) {
    var errorJson;
    try { errorJson = $.parseJSON(errorResponse); } catch(e){}
    this.setProperties({ 'isError': true, 'errors': errorJson });
    this._triggerEvent('becameError', this.get('errors'));
  }
});

/*
 * Model
 * Base model class
 */
RESTless.Model = Ember.Object.extend( RESTless.State, Ember.Copyable, {
  /* 
   * id: unique id number, default primary id
   */
  id: RESTless.attr('number'),

  /* 
   * isNew: model has not yet been saved
   */
  isNew: function() {
    var primaryKey = get(this.constructor, 'primaryKey');
    return none(this.get(primaryKey));
  }.property(),

  /* 
   * init: on instance creation
   */
  init: function() {
    this._initProperties();
    this._addPropertyObservers();
  },

  /* 
   * _initProperties: (private)
   * Any special setup needed for certain property types
   */
  _initProperties: function() {
    var attributeMap = get(this.constructor, 'attributeMap'), attr;
    // Loop through each property and init any relationships
    for(attr in attributeMap) {
      if (attributeMap.hasOwnProperty(attr)) {
        if(attributeMap[attr].get('hasMany')) {
          this.set(attr, RESTless.RecordArray.createWithContent({type: attributeMap[attr].get('type')}));
        } else if(attributeMap[attr].get('belongsTo')) {
          this.set(attr, get(window, attributeMap[attr].get('type')).create());
        }
      }
    }
  },

  /* 
   * _addPropertyObservers: (private)
   * adds observers for each property for 'isDirty' functionality
   */
  _addPropertyObservers: function() {
    var attributeMap = get(this.constructor, 'attributeMap'), attr;
    // Start observing *all* property changes for 'isDirty' functionality
    for(attr in attributeMap) {
      if (attributeMap.hasOwnProperty(attr)) {
        if(attributeMap[attr].get('isRelationship')) {
          // if a relationship property becomes dirty, need to mark its owner as dirty
          this.addObserver(attr+'.isDirty', this, this._onRelationshipChange);
        } else {
          this.addObserver(attr, this, this._onPropertyChange);
        }
      }
    }
  },

  /* 
   * _onPropertyChange: (private) called when any property of the model changes
   * If the model has been loaded, or is new, isDirty flag is set to true.
   */
  _onPropertyChange: function() {
    if(this.get('isLoaded') || this.get('isNew')) {
      this.set('isDirty', true);
    }
  },
  /* 
   * _onRelationshipChange: (private) called when a relationship property's isDirty state changes
   * Forwards a _onPropertyChange event for the parent object
   */
  _onRelationshipChange: function(sender, key) {
    if(sender.get(key)) { // if isDirty
      this._onPropertyChange();
    }
  },

  /* 
   * copy: creates a copy of the object. Implements Ember.Copyable protocol
   * http://emberjs.com/api/classes/Ember.Copyable.html#method_copy
   */
  copy: function(deep) {
    var clone = this.constructor.create(),
        attributeMap = get(this.constructor, 'attributeMap'),
        attr, value;

    Ember.beginPropertyChanges(this);
    for(attr in attributeMap) {
      if(attributeMap.hasOwnProperty(attr)) {
        value = this.get(attr);
        if(value !== null) { clone.set(attr, value); }
      }
    }
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
   * primaryKey: property name for the primary key.
   * Configurable. Defaults to 'id'.
   */
  primaryKey: function() {
    var className = this.toString(),
        modelConfig = get(RESTless, 'client._modelConfigs').get(className);
    if(modelConfig && modelConfig.primaryKey) {
      return modelConfig.primaryKey;
    }
    return 'id';
  }.property('RESTless.client._modelConfigs'),

  /*
   * resourceName: path to the resource endpoint, determined from class name
   * i.e. MyApp.Post = RESTless.Model.extend({ ... })  =>  'post'
   */
  resourceName: function() {
    var className = this.toString(),
        parts = className.split('.');
    return parts[parts.length-1].toLowerCase();
  }.property(),

  /*
   * resourceNamePlural: resourceName pluralized
   * Define custom plural words in a custom adapter
   */
  resourceNamePlural: function() {
    var name = get(this, 'resourceName'),
        plurals = get(RESTless, 'client._pluralConfigs');
    return (plurals && plurals[name]) || name + 's';
  }.property('resourceName'),

  /*
   * attributeMap: stores all of the RESTless Attribute definitions.
   * This should be pre-fetched before attemping to get/set properties on the model object. (called in init)
   */
  attributeMap: function() {
    var proto = this.prototype,
        attributeMap = {}, key;
    for(key in proto) {
      if(proto[key] instanceof RESTless._Attribute) {
        attributeMap[key] = proto[key];
        this.prototype[key] = null; //clear the prototype after collection
      }
    }
    return attributeMap;
  }.property(),

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
    var result = this.create();

    result.deserialize(data);
    result.set('isLoaded', true);

    return result;
  },

  /*
   * loadMany: Create collection of records directly from data representation.
   */
  loadMany: function(data) {
    var result = RESTless.RecordArray.createWithContent({ type: this.toString() });

    result.deserializeMany(data);
    result.set('isLoaded', true);

    return result;
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
   * init: for read-only models, we don't need to _addPropertyObservers 
   */
  init: function() {
    this._initProperties();
  },
  /*
   * Remove functionality associated with writing data
   */
  serialize: null,
  saveRecord: null,
  deleteRecord: null
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
        itemClass = type ? get(window, type) : Ember.Object;
    this.pushObject(itemClass.create(opts));
  },

  /*
   * resourceTypeNamePlural: helper to get the plural resource name for array object type
   */
  resourceTypeNamePlural: function() {
    var typeInstance = get(window, this.get('type')).create();
    return get(typeInstance.constructor, 'resourceNamePlural');
  }.property('type'),

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
   * _onContentChange: (private) observes when items in the array are changed.
   * Marks the RecordArray as dirty if loaded.
   */
  _onContentChange: function() {
    if(this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  }.observes('@each'),
  /*
   * _onItemDirtyChange: (private) observes when items become dirty
   */
  _onItemDirtyChange: function() {
    var clean = this.get('content').everyProperty('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }.observes('@each.isDirty'),
  /*
   * _onLoadedChange: (private) observes when the array's isLoaded state changes
   * and updates each item's isLoaded to match
   */
  _onLoadedChange: function() {
    if(this.get('isLoaded')) {
      this.setEach('isLoaded', true);
    }
  }.observes('isLoaded')
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
 * JSONTransforms
 * Base serializers/deserializers for each attribute type
 * This is an add-on, and is not necessary for RESTless to function
 *
 * Courtesy of ember-data
 * https://github.com/emberjs/data/blob/master/packages/ember-data/lib/transforms/json_transforms.js
 */

RESTless.JSONTransforms = {
  string: {
    deserialize: function(serialized) {
      return none(serialized) ? null : String(serialized);
    },
    serialize: function(deserialized) {
      return none(deserialized) ? null : String(deserialized);
    }
  },

  number: {
    deserialize: function(serialized) {
      return empty(serialized) ? null : Number(serialized);
    },
    serialize: function(deserialized) {
      return empty(deserialized) ? null : Number(deserialized);
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
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            pad = function(num) {
              return num < 10 ? "0"+num : ""+num;
            };

        var utcYear = date.getUTCFullYear(),
            utcMonth = date.getUTCMonth(),
            utcDayOfMonth = date.getUTCDate(),
            utcDay = date.getUTCDay(),
            utcHours = date.getUTCHours(),
            utcMinutes = date.getUTCMinutes(),
            utcSeconds = date.getUTCSeconds(),
            dayOfWeek = days[utcDay],
            dayOfMonth = pad(utcDayOfMonth),
            month = months[utcMonth];

        return dayOfWeek + ", " + dayOfMonth + " " + month + " " + utcYear + " " +
               pad(utcHours) + ":" + pad(utcMinutes) + ":" + pad(utcSeconds) + " GMT";
      } else {
        return null;
      }
    }
  }
};

})(this, jQuery, Ember);