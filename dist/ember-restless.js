/*!
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.1.3
 * last modifed: 2013-05-02
 *
 * Garth Poitras <garth22@gmail.com>
 * Copyright (c) 2013 Endless, Inc.
 */

(function(window, $, Ember, undefined){

"use strict";

var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

if ('undefined' === typeof RESTless) {
  /*
   * RESTless
   * Create as am Ember Namespace.
   * Track version and API revision number.
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.1.3',
    CURRENT_API_REVISION: 1
  });

  /*
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if ('undefined' !== typeof window) {
    window.RL = window.RESTless = RESTless;
  }
}

/*
 * RESTless._Attribute (private)
 * Stores metadata about model property types
 */

RESTless._Attribute = Ember.ObjectProxy.extend({
  type: null,
  belongsTo: false,
  hasMany: false,
  readOnly: false
});

/*
 * Public interfaces to define model properties
 */
 
/*
 * Standard property
 */
RESTless.attr = function(type, opts) {
  opts = $.extend({ type: type }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * belongsTo: One-to-one relationship between two models
 */
RESTless.belongsTo = function(type, opts) {
  opts = $.extend({ type: type, belongsTo:true }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * hasMany: One-to-many & many-to-many relationships
 */
RESTless.hasMany = function(type, opts) {
  opts = $.extend({ type: type, hasMany:true }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * RESTAdapter
 * The base REST adapter
 * Core responsibilities include:
 * - storing the location and custom configurations of the remote REST service
 * - building ajax requests
 * - serializing ember models to json to send to backend
 * - deserializing json from backend into ember models
 */

RESTless.RESTAdapter = Ember.Object.extend({
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
   * configurations: custom options to be used by a custom adapter
   * i.e. plurals - to set the plural resource name of 'person' to 'people'
   * i.e. models - to set a different primary key for a certain model type
   */
  configurations: Ember.Object.create({
    plurals: Ember.Object.create(),
    models: Ember.Map.create()
  }),

  /*
   * configure: method to set allowed configurations
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
   * map: configure helper to map configurations for model types
   * i.e :
      App.RESTAdapter.map('App.Post', {
        primaryKey: 'slug'
      });
      //or
      App.RESTAdapter.map('App.Person', {
        lastName: { key: 'lastNameOfPerson' }
      });
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
  request: function(params, resourceName, resourceKey) {
    var urlParts = [this.get('rootPath'), resourceName];
    if(resourceKey) {
      urlParts.push(resourceKey);
    }
    params.url = urlParts.join('/');
    params.dataType = 'json';
    params.contentType = 'application/json; charset=utf-8';
    if(params.data && params.type !== 'GET') {
      params.data = JSON.stringify(params.data);
    }
    return $.ajax(params);
  },

  /* 
   * deserialize: translates json object into a model. i.e:
   * { id:1, name:'post 1' }
   */
  deserialize: function(resource, json) {
    Ember.beginPropertyChanges(resource);
    var prop;
    for(prop in json) {
      if (json.hasOwnProperty(prop)) {
        this.deserializeProperty(resource, prop, json[prop]);
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
      // store a reference to the parent model on each item
      // when a property on an array item changes, the parent object can then be marked as dirty
      // TODO: find a cleaner way
      hasManyArr.forEach(function(item, i) {
        item.set('parentObject', resource);
      });
      resource.set(formattedProp, hasManyArr);
      return;
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if(attr.get('belongsTo')) {
      var belongsToModel = get(window, attrType).create();
      this.deserialize(belongsToModel, value);
      resource.set(formattedProp, belongsToModel);
      return;
    }
    
    // Check for a custom transform
    if(attrType && RESTless.JSONTransforms[attrType]) {
      value = RESTless.JSONTransforms[attrType].deserialize(value);
    }
    resource.set(formattedProp, value);
  },

  /* 
   * deserializeMany: deserializes an array of json objects for hasMany relationships
   */
  deserializeMany: function(resource, type, jsonArr) {
    if(!jsonArr) { return; }
    var result = resource,
        len = jsonArr.length,
        resourceArr = [], item, i;
    if(result) {
      result.clear();
    } else {
      result = RESTless.RESTArray.createWithContent({type: type});
    }

    for(i=0; i<len; i++) {
      item = get(window, type).create().deserialize(jsonArr[i]).set('isLoaded', true);
      resourceArr.push(item);
    }
    if(resourceArr.length) {
      result.pushObjects(resourceArr);
    }
    return result;
  },

  /* 
   * serialize: turns Ember model into json to send to REST API
   */
  serialize: function(resource) {
    var resourceName = get(resource.constructor, 'resourceName'),
        attrMap = get(resource.constructor, 'attributeMap'),
        json = {},
        attr, val;

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
   * serializeMany: serializes an array of json objects for hasMany relationships
   */
  serializeMany: function(resourceArr, type) {
    var resourceName = get(get(window, type), 'resourceName'),
        result = [],
        len = resourceArr.length,
        i;
    for(i=0; i<len; i++) {
      var item = resourceArr[i].serialize();
      result.push(item[resourceName]);
    }
    return result;
  },

  /*
   * registerTransform: adds a custom transform to JSONTransforms
   */
  registerTransform: function(type, transform) {
    Ember.warn("You are overwritting an existing transform: '" + type + "'", !RESTless.JSONTransforms[type]);
    RESTless.JSONTransforms[type] = transform;
  },

  /*
   * extractMeta: hook called on deserializtion
   * Overwrite this hook in your custom adapter to extract extra metadata from json
   */
  extractMeta: function(json) {
    if(json && json.meta) {
      return json.meta;
    }
  }
});

/*
 * JSONTransforms
 * Hash for custom json transforms
 * Bulding with transforms.js is optional, and will overwrite this
 */
RESTless.JSONTransforms = {};

/* RESTClient
 * Core interface that houses the REST adapter and revision of the API to target.
 * Setting a Client is optional and will automatically use a base client.
 *
 * You can define a custom client on your app like you would DS.Store in ember-data
 * Assign a revision number to be notified of breaking changes to the API
 */

RESTless.RESTClient = Ember.Object.extend({
  revision: RESTless.CURRENT_API_REVISION,
  adapter: RESTless.RESTAdapter.create(),
  
  // Private shortcut aliases:
  _configs: Ember.computed.alias('adapter.configurations'),
  _pluralConfigs: Ember.computed.alias('adapter.configurations.plurals'),
  _modelConfigs: Ember.computed.alias('adapter.configurations.models')
});

Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'RESTClient',
    initialize: function(container, application) {
      // On app initialize, if custom RESTClient is present,
      // set that as the default client
      if(application.RESTClient) {
        RESTless.set('client', application.RESTClient);
      } else {
        // Set a default client
        RESTless.set('client', RESTless.RESTClient.create());
      }
      // Add an observer so you can set a client at a later date
      application.addObserver('RESTClient', this, function() {
        RESTless.set('client', this.RESTClient);
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
   * isLoaded: model has downloaded from REST service
   */
  isLoaded: false,
  /* 
   * isDirty: model has changes that have not yet been saved to REST service
   */
  isDirty: false,
  /* 
   * isSaving: model is in the process of saving to REST service
   */
  isSaving: false,
  /* 
   * isError: model has been marked as invalid after response from REST service
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
 * Base class for RESTful models
 */

RESTless.Model = Ember.Object.extend( RESTless.State, Ember.Copyable, {
  /* 
   * id: unique id number, default primary id
   */
  id: RESTless.attr('number'),

  /*
   * currentRequest: stores the active ajax request as a property.
   * Useful for accessing the promise callbacks.
   * Automatically set to null when request completes
   */
  currentRequest: null,

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
          this.set(attr, RESTless.RESTArray.createWithContent({type: attributeMap[attr].get('type')}));
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
        if(attributeMap[attr].get('hasMany')) {
          this.addObserver(attr+'.@each', this, this._onPropertyChange);
        } else {
          this.addObserver(attr, this, this._onPropertyChange);
        }
      }
    }
  },

  /* 
   * _onPropertyChange: (private) called when any property of the model changes
   * If the model has been loaded, or is new, isDirty flag is set to true.
   * If the property contains a 'parentObject' (hasMany array items), set the parent isDirty.
   */
  _onPropertyChange: function() {
    var parent = this.get('parentObject'),
        targetObject = parent || this;
    if(targetObject.get('isLoaded') || targetObject.get('isNew')) {
      targetObject.set('isDirty', true);
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
   * serialize: use the current Adapter turn the model into json representation
   */
  serialize: function() {
    return RESTless.get('client.adapter').serialize(this);
  },

  /* 
   * deserialize: use the current Adapter to set the model properties from supplied json
   */
  deserialize: function(json) {
    return RESTless.get('client.adapter').deserialize(this, json);
  },

  /* 
   * deserializeResource: (helper) deserializes a single, wrapped resource. i.e:
   * { post: { id:1, name:'post 1' } }
   * This is the json format returned from Rails ActiveRecord on create or update
   */
  deserializeResource: function(json) {
    var resourceName = get(this.constructor, 'resourceName');
    return this.deserialize(json[resourceName]);
  },

  /*
   * request: returns an ajax request from the current Adapter.
   * Attemps to extract a resource key and keeps state of the currentRequest
   */
  request: function(params, resourceKey) {
    var resourceName = get(this.constructor, 'resourceNamePlural'),
        primaryKey = get(this.constructor, 'primaryKey'),
        key = resourceKey || this.get(primaryKey),
        self = this, request;

    // Get the ajax request
    request = RESTless.get('client.adapter').request(params, resourceName, key);

    // Store a reference to the active request and destroy it when finished
    this.set('currentRequest', request);
    request.always(function() {
      self.set('currentRequest', null);
    });
    return request;
  },

  /*
   * saveRecord: POSTs a new record, or PUTs an updated record to REST service
   */
  saveRecord: function() {
    //If an existing model isn't dirty, no need to save.
    if(!this.get('isNew') && !this.get('isDirty')) {
      return $.Deferred().resolve();
    }
    this.set('isSaving', true);

    var self = this,
        isNew = this.get('isNew'), // purposely cache value for triggering correct event later
        method = isNew ? 'POST' : 'PUT',
        saveRequest = this.request({ type: method, data: this.serialize() });

    saveRequest.done(function(json){
      self.deserializeResource(json);
      self.clearErrors();
      self.set('isDirty', false);
      self._triggerEvent(isNew ? 'didCreate' : 'didUpdate');
    })
    .fail(function(jqxhr) {
      self._onError(jqxhr.responseText);
    })
    .always(function() {
      self.set('isSaving', false);
      self.set('isLoaded', true);
      self._triggerEvent('didLoad');
    });

    return saveRequest;
  },

  /*
   * deleteRecord: DELETEs record from REST service
   */
  deleteRecord: function() {
    var self = this,
        deleteRequest = this.request({ type: 'DELETE', data: this.serialize() });
        
    deleteRequest.done(function(){
      self._triggerEvent('didDelete');
      self.destroy();
    })
    .fail(function(jqxhr) {
      self._onError(jqxhr.responseText);
    });
    return deleteRequest;
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
        modelConfig = Ember.get('RESTless.client._modelConfigs').get(className);
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
   * This should be pre-fetched before attemping to get/set properties on the model object.
   */
  attributeMap: function() {
    var proto = this.prototype,
        attributeMap = {},
        key;
    for(key in proto) {
      if(proto[key] instanceof RESTless._Attribute) {
        attributeMap[key] = proto[key];
        this.prototype[key] = null; //clear the prototype after collection
      }
    }
    return attributeMap;
  }.property(),

  /*
   * find: fetches a single resource with a key as the param.
   * Also an alias to findAll objects of this type with specified params
   */
  find: function(params) {
    var primaryKey = get(this, 'primaryKey'),
        singleResourceRequest = typeof params === 'string' || typeof params === 'number' ||
                                (typeof params === 'object' && params.hasOwnProperty(primaryKey)), key;
    if(singleResourceRequest) {
      key = params.hasOwnProperty(primaryKey) ? params[primaryKey] : params;
      return this._findByKey(key);
    } else {
      return this.findAll(params);
    }
  },

  /*
   * findAll: fetches all objects of this type with specified params
   */
  findAll: function(params) {
    var resourceNamePlural = get(this, 'resourceNamePlural'),
        resourceInstance = this.create(),
        result = RESTless.RESTArray.createWithContent({ type: this.toString() }),
        findRequest = resourceInstance.request({ type: 'GET', data: params });

    findRequest.done(function(json){
      result.deserializeMany(json[resourceNamePlural]);
      result.clearErrors();
      //call extract metadata hook
      var meta = RESTless.get('client.adapter').extractMeta(json);
      if(meta) { result.set('meta', meta); }
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
   * _findByKey: (private) fetches object with specified key value
   * 'find' handles all cases, and reroutes to here if necessary
   */
  _findByKey: function(key) {
    var resourceName = get(this, 'resourceName'),
        result = this.create(),
        findRequest = result.request({ type: 'GET' }, key);

    findRequest.done(function(json){
      result.deserialize(json[resourceName]);
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
 * RESTArray
 * Base class extention for RESTful arrays
 */

RESTless.RESTArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model the array contains
   */
  type: null,

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function(opts) {
    var type = this.get('type'), itemProto;
    if(type) {
      itemProto = get(window, type) || Ember.Object;
    }
    this.pushObject(itemProto.create(opts));
  },

  /* 
   * serializeMany: use the current Adapter turn the array into json representation
   */
  serializeMany: function() {
    return RESTless.get('client.adapter').serializeMany(this, this.get('type'));
  },

  /* 
   * deserializeMany: use the current Adapter to populate the array from supplied json
   */
  deserializeMany: function(json) {
    return RESTless.get('client.adapter').deserializeMany(this, this.get('type'), json);
  }
});

/*
 * RESTArray (static)
 */
RESTless.RESTArray.reopenClass({
  /*
   * createWithContent: helper to create a RESTArray with the content property initialized
   */
  createWithContent: function(opts) {
    var mergedOpts = $.extend({ content: Ember.A() }, opts);
    return RESTless.RESTArray.create(mergedOpts);
  }
});

/*
 * JSONTransforms
 * Base serializers/deserializers for each attribute type
 *
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