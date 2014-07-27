/**
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.5.3
 * last modifed: 2014-07-27
 *
 * Garth Poitras <garth22@gmail.com>
 * Copyright (c) 2013-2014 Endless, Inc.
 */

(function(window, $, Ember, undefined){

'use strict';

/** 
  @module ember-restless
 */
var get = Ember.get, set = Ember.set,
    isNone = Ember.isNone, isEmpty = Ember.isEmpty,
    merge = Ember.merge, noop = Ember.K,
    computed = Ember.computed, oneWay = computed.oneWay, 
    RSVPPromise = Ember.RSVP.Promise,
    exports = Ember.exports || this,
    RESTless;

if ('undefined' === typeof RESTless) {
  /**
    All Ember RESTless functionality is defined inside of this namespace.
    @class RESTless
    @static
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.5.3'
  });

  /*
    A shortcut alias to the RESTless namespace.
    Similar to `Ember` and `Em`.
    Expose to global namespace.
   */
  exports.RL = exports.RESTless = RESTless;

  if (Ember.libraries) { 
    Ember.libraries.register('Ember RESTless', RESTless.VERSION);
  }
}

/**
  Defines an attribute on a Model.
  Supports types: 'string', 'number', 'boolean', 'date'.

  @method attr
  @for RESTless
  @param {String} type the attribute type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.attr = function(type, opts) {
  var meta = merge({ type: type, isAttribute: true }, opts);
  return makeComputedAttribute(meta);
};

/**
  Defines a one-to-one relationship attribute on a Model.

  @method belongsTo
  @for RESTless
  @param {String} type the belongsTo Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.belongsTo = function(type, opts) {
  var meta = merge({ type: type, isRelationship: true, belongsTo: true }, opts);
  return makeComputedAttribute(meta);
};

/**
  Defines a one-to-many relationship attribute on a Model.

  @method hasMany
  @for RESTless
  @param {String} type the hasMany Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.hasMany = function(type, opts) {
  var defaultArray = function() {
    return RESTless.RecordArray.createWithContent();
  },
  meta = merge({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
  return makeComputedAttribute(meta);
};

function makeComputedAttribute(meta) {
  return computed(function(key, value) {
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

/**
  Base class for transforming data to/from persistence layer in the Adapter.
  Subclasses should implement `serialize` & `deserialize` methods.
  These are copied closely from ember-data:
  `https://github.com/emberjs/data/tree/master/packages/ember-data/lib/transforms`

  @class Transform
  @namespace RESTless
  @extends Ember.Object
 */
RESTless.Transform = Ember.Object.extend({
  /**
    Transforms serialized data (i.e. JSON) to deserialized data (i.e. Ember models).
    Subclasses should implement.

    @method deserialize
    @param serialized serialized data
    @return deserialize data
  */
  deserialize: function(serialized) {
    return serialized;
  },
  
  /**
    Transforms deserialized data (i.e. Ember models) to serialized data (i.e. JSON).

    @method serialize
    @param deserialized deserialized data
    @return serialized data
  */
  serialize: function(deserialized) {
    return deserialized;
  }
});

RESTless.StringTransform = RESTless.Transform.extend({
  deserialize: function(serialized) {
    return isNone(serialized) ? null : String(serialized);
  },
  serialize: function(deserialized) {
    return isNone(deserialized) ? null : String(deserialized);
  }
});

RESTless.NumberTransform = RESTless.Transform.extend({
  deserialize: function(serialized) {
    return isEmpty(serialized) ? null : Number(serialized);
  },
  serialize: function(deserialized) {
    return isEmpty(deserialized) ? null : Number(deserialized);
  }
});

RESTless.BooleanTransform = RESTless.Transform.extend({
  deserialize: function(serialized) {
    var type = typeof serialized;

    if (type === 'boolean') {
      return serialized;
    } else if (type === 'string') {
      return serialized.match(/^true$|^t$|^1$/i) !== null;
    } else if (type === 'number') {
      return serialized === 1;
    } else {
      return false;
    }
  },
  
  serialize: function(deserialized) {
    return Boolean(deserialized);
  }
});

RESTless.DateTransform = RESTless.Transform.extend({
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
});

/**
  @property JSONTransforms
  @type Object
  @for RESTless
*/
RESTless.JSONTransforms = {
  'string'  : RESTless.StringTransform.create(),
  'number'  : RESTless.NumberTransform.create(),
  'boolean' : RESTless.BooleanTransform.create(),
  'date'    : RESTless.DateTransform.create()
};

/**
  Serializers handle transforming data to and from raw data and Models.
  This is a base class to be subclassed.

  @class Serializer
  @namespace RESTless
  @extends Ember.Object
*/
RESTless.Serializer = Ember.Object.extend({
  /**
    Type of data to serialize.
    @property dataType
    @type String
    @example json, jsonp, xml, html
  */
  dataType: null,
  /**
    Additional content type headers when transmitting data.
    @property dataType
    @type String
    @optional
  */
  contentType: null,

  /**
    Transforms raw data into model. Abstract - implement in subclass.
    @method deserialize
  */
  deserialize: noop,
  /**
    Transforms raw data property into model property. Abstract - implement in subclass.
    @method deserializeProperty
  */
  deserializeProperty: noop,
  /**
    Transforms array of raw data into record array. Abstract - implement in subclass.
    @method deserializeMany
  */
  deserializeMany: noop,
  /**
    Transforms model into raw data. Abstract - implement in subclass.
    @method serialize
  */
  serialize: noop,
  /**
    Transforms model property into raw data property. Abstract - implement in subclass.
    @method serializeProperty
  */
  serializeProperty: noop,
  /**
    Transforms a record array into raw data array. Abstract - implement in subclass.
    @method serializeMany
  */
  serializeMany: noop,
  /**
    To register a custom attribute transform. Abstract - implement in subclass.
    @method registerTransform
    @optional
  */
  registerTransform: noop,

  /**
    Returns a model class for a particular type.
    @method modelFor
    @param {String or subclass of RL.Model} type
    @return {subclass of RL.Model}
  */
  modelFor: function(type) {
    if (typeof type === 'string') {
      return get(Ember.lookup, type);
    }
    return type;
  },

  /**
    Optional override to prep data before persisting.
    @method prepareData
    @return Object
    @optional
  */
  prepareData: function(data) {
    return data;
  },
  /**
    Optional override to deserialize error messages.
    @method parseError
    @return Object
    @optional
  */
  parseError: function(error) {
    return error;
  }
});

/**
  Handles transforming json data to Models and Models to json data.

  @class JSONSerializer
  @namespace RESTless
  @extends RESTless.Serializer
*/
RESTless.JSONSerializer = RESTless.Serializer.extend({

  /**
    Type of data to serialize.
    @property dataType
    @type String
    @default 'json'
  */
  dataType: 'json',
  /**
    Additional content type headers when transmitting data.
    @property contentType
    @type String
    @default 'application/json; charset=utf-8'
  */
  contentType: 'application/json; charset=utf-8',

  /**
    Transforms json object into model
    @method deserialize
    @param {RESTless.Model} resource model resource
    @param {Object} data json data
    @return {RESTless.Model}
  */
  deserialize: function(resource, data) {
    if(!data) { return resource; }

    var key, prop, meta;

    // Check for wrapped object by resource name: { post: { id:1, name:'post 1' } }
    // This is the default from ActiveRecord
    key = this._keyForResource(resource);
    if(data[key]) {
      data = data[key];
    }

    // extract any meta info
    meta = this.extractMeta(data);
    if(meta) { 
      resource.set('meta', meta);
    }

    // iterate over each json property and deserialze
    Ember.beginPropertyChanges(resource);
    for(prop in data) {
      if (data.hasOwnProperty(prop)) {
        this.deserializeProperty(resource, prop, data[prop]);
      }
    }
    resource.setProperties({ isLoaded: true, isDirty: false });
    Ember.endPropertyChanges(resource);
    return resource;
  },

  /**
    Transforms json key/value into model property
    @method deserializeProperty
    @param {RESTless.Model} resource model resource
    @param {Object} prop json data key
    @param {Object} value json data value
  */
  deserializeProperty: function(resource, prop, value) {
    var attrName = this.attributeNameForKey(resource.constructor, prop),
        fields = get(resource.constructor, 'fields'),
        field = fields.get(attrName), type, klass, belongsToModel;

    // If the json contains a key not defined on the model, don't attempt to set it.
    if (!field) { return; }

    type = field.type;

    // If property is a hasMany relationship, deserialze the array
    if (field.hasMany) {
      var hasManyArr = this.deserializeMany(resource.get(attrName), type, value);
      resource.set(attrName, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if (field.belongsTo && value) {
      klass = this.modelFor(type);
      if(klass) {
        belongsToModel = klass.create({ isNew: false, isLoaded: true }).deserialize(value);
        resource.set(attrName, belongsToModel);
      }
    }
    else {
      // Check for a custom transform
      if (type && RESTless.JSONTransforms[type]) {
        value = RESTless.JSONTransforms[type].deserialize(value);
      }
      resource.set(attrName, value);
    }
  },

  /**
    Transforms json array into a record array
    @method deserializeMany
    @param {RESTless.RecordArray} recordArray RecordArray
    @param {String} type records class name
    @param {Object} data json data
    @return {RESTless.RecordArray}
  */
  deserializeMany: function(recordArray, type, data) {
    if(!data) { return recordArray; }

    var arrayData = this._arrayDataForType(type, data),
        meta, i, len, item, content, klass;

    if(!arrayData) { return recordArray; }

    if(recordArray) {
      recordArray.set('isLoaded', false);
      recordArray.clear();
    } else {
      recordArray = RESTless.RecordArray.createWithContent();
    }

    len = arrayData.length;
    if(len) {
      content = [];
      klass = this.modelFor(type);
      for(i=0; i<len; i++) {
        item = arrayData[i];
        if(klass && typeof item === 'object') {
          item = klass.create({ isNew: false }).deserialize(item);
        }
        content.push(item);
      }
      recordArray.pushObjects(content);
    }

    // extract any meta info
    meta = this.extractMeta(data);
    if(meta) { recordArray.set('meta', meta); }

    recordArray.setProperties({ isLoaded: true, isDirty: false });

    return recordArray;
  },

  /**
    Transforms a Model into json
    @method serialize
    @param {RESTless.Model} resource Model to serialize
    @param {Object} [options] additional serialization options
    @return {Object} json data
  */
  serialize: function(resource, options) {
    if(!resource) { return null; }

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

  /**
    Transforms a Model property into json value
    @method serializeProperty
    @param {RESTless.Model} resource Model to serialize
    @param {String} prop property to serialize
    @param {Object} [opts] Model metadata
    @return {Object} json value
  */
  serializeProperty: function(resource, prop, opts) {
    var value = resource.get(prop), type;

    if (!opts) {
      opts = resource.constructor.metaForProperty(prop);
    }
    type = opts.type;

    if (opts && opts.hasMany) {
      return this.serializeMany(value, type);
    } else if(opts.belongsTo) {
      return this.serialize(value, { nonEmbedded: true });
    }

    //Check for a custom transform
    if(opts.type && RESTless.JSONTransforms[type]) {
      value = RESTless.JSONTransforms[type].serialize(value);
    }
    return value;
  },

  /**
    Transforms a RecordArray into a json array
    @method serializeMany
    @param {RESTless.RecordArray} recordArray RecordArray
    @param {String} type records class name
    @return {Object} json array
  */
  serializeMany: function(recordArray, type) {
    var key = this._keyForResourceType(type),
        array = recordArray.get('content'),
        len = array.length,
        result = [], i, item;
    for(i=0; i<len; i++) {
      item = array[i];
      if(RESTless.Model.detectInstance(item)) {
        item = item.serialize();
      }
      result.push(item[key]);
    }
    return result;
  },

  /**
    Helper to transform resource name to valid json key
    @method keyForResourceName
    @param {String} name Model class name 
    @return {String} json key name
   */
  keyForResourceName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /**
    Helper to transform attribute name to valid json key
    @method keyForAttributeName
    @param {String} name Model property name
    @return {String} json key name
   */
  keyForAttributeName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /*
   * attributeNameForKey: returns ember property name based on json key
   */
  /**
    Helper to get Model property name from json key name
    @method attributeNameForKey
    @param {RESTless.Model} klass Model class
    @param {String} key Model property name
    @return {String} Model property name
   */
  attributeNameForKey: function(klass, key) {
    // check if a custom key was configured for this property
    var modelConfig = get(RESTless, 'client._modelConfigs').get(klass.toString());
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[key]) {
      return modelConfig.propertyKeys[key];
    }
    return Ember.String.camelize(key);
  },

  /**
    JSON should be stringified before transmitting.
    @method prepareData
    @return Object
  */
  prepareData: function(data) {
    return JSON.stringify(data);
  },
  /**
    Transforms error response text into json.
    @method parseError
    @return Object
  */
  parseError: function(error) {
    var errorData = null;
    try { errorData = JSON.parse(error); } catch(e){}
    return errorData;
  },
  /**
    Attempts to extract metadata on json responses
    @method extractMeta
    @return Object
  */
  extractMeta: function(json) {
    if(json && json.meta) {
      return json.meta;
    }
  },
  /**
    To register a custom attribute transform. Adds to JSONTransforms.
    @method registerTransform
    @param {String} type attribute type name
    @parma {Object} custom serialize and deserialize method hash
  */
  registerTransform: function(type, transform) {
    RESTless.JSONTransforms[type] = transform;
  },

  /**
    @method _keyForResource
    @private
  */
  _keyForResource: function(resource) {
    return this.keyForResourceName(get(resource.constructor, 'resourceName'));
  },
  /**
    @method _keyForResourceType
    @private
  */
  _keyForResourceType: function(type) {
    var klass = this.modelFor(type);
    return klass ? this.keyForResourceName(get(klass, 'resourceName')) : 'model';
  },
  /**
    @method _keyPluralForResourceType
    @private
  */
  _keyPluralForResourceType: function(type) {
    var klass = this.modelFor(type);
    return klass ? get(klass, 'resourceNamePlural') : null;
  },
  /**
    Checks for wrapped array data by resource name: { posts: [...] }
    This is the default from ActiveRecord on direct finds
    @method _arrayDataForType
    @private
  */
  _arrayDataForType: function(type, data) {
    if(Ember.isArray(data)) {
      return data;
    } else {
      var keyPlural = this._keyPluralForResourceType(type);
      if(data[keyPlural]) {
        return data[keyPlural];
      }
    }
    return null;
  }
});

/**
  Adapters handle sending and fetching data to and from a persistence layer.
  This is a base class to be subclassed.

  @class Adapter
  @namespace RESTless
  @extends Ember.Object
*/
RESTless.Adapter = Ember.Object.extend({
  /**
    Instance of a Serializer used to transform data
    @property serializer
    @type RESTless.Serializer
   */
  serializer: null,

  /**
    Saves a record. Abstract - implement in subclass.
    @method saveRecord
  */
  saveRecord: noop,
  /**
    Deletes a record. Abstract - implement in subclass.
    @method deleteRecord
  */
  deleteRecord: noop,
  /**
    Finds all records. Abstract - implement in subclass.
    @method findAll
  */
  findAll: noop,
  /**
    Finds records by query. Abstract - implement in subclass.
    @method findQuery
  */
  findQuery: noop,
  /**
    Finds record by primary key. Abstract - implement in subclass.
    @method findByKey
  */
  findByKey: noop,
  /**
    Generates a unique id for new records. Abstract - implement in subclass.
    @method generateIdForRecord
  */
  generateIdForRecord: noop,

  /**
    Finds records with specified params.
    A convenience method that can be used to intelligently route to 
    ```findAll``` ```findQuery``` ```findByKey``` based on its params.
    @method find
    @param {Object} klass Model class type
    @param {Object} [params] a hash of params.
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

  /**
    Fetch wraps `find` in a promise for async find support.
    @method fetch
    @param {Object} klass Model class type
    @param {Object} [params] a hash of params.
    @return Ember.RSVP.Promise
  */
  fetch: function(klass, params) {
    var adapter = this, find,
    promise = new RSVPPromise(function(resolve, reject) {
      find = adapter.find(klass, params);
      find.one('didLoad', function(model) {
        resolve(model);
      });
      find.one('becameError', function(error) {
        reject(error);
      });
    });
    // private: access to find for subclasses
    promise._find = find;
    return promise;
  },

  /**
    Refreshes an existing record from the data store.
    @method reloadRecord
    @param {RESTless.Model} record The record to relead
    @return Ember.RSVP.Promise
  */
  reloadRecord: function(record) {
    var klass = record.constructor,
        primaryKey = get(klass, 'primaryKey'),
        key = record.get(primaryKey);

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(isNone(key)) {
      return new RSVPPromise(function(resolve, reject){
        reject(null);
      });
    }

    return this.fetch(klass, key);
  },

  /**
    Stores info about custom configurations.
    * plurals - to set the plural resource name ('person' to 'people').
    * models - to set a different primary key for a model type.
    @property configurations
    @type Ember.Object
  */
  configurations: Ember.Object.create({
    plurals: Ember.Object.create(),
    models: Ember.Map.create()
  }),


  /**
    Helper method to set allowed configurations.
    @method configure
    @param {Object} type config key
    @param {Object} value config value
    @chainable
  */
  configure: function(type, value) {
    var configs = this.get('configurations'),
        configForType = configs.get(type);
    if(configForType) {
      configs.set(type, merge(configForType, value));
    }
    return this;
  },

  /**
    Helper to map configurations for model types.
    @method map
    @param {String} modelKey Model type
    @param {Object} config config value
    @chainable
    @example
      <pre class="prettyprint">
      App.Adapter.map('App.Post', { primaryKey: 'slug' });
      App.Adapter.map('App.Person', { lastName: { key: 'lastNameOfPerson' } });</pre>
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
        modelConfig = modelConfig ? merge(modelConfig, newConfig) : newConfig;
      }
    }
    modelMap.set(modelKey, modelConfig);
    return this;
  },

  /**
    Helper to pluralize a model resource names.
    Checks custom configs or simply appends a 's'.
    @method pluralize
    @param {String} resourceName Name of model class
    @return {String} plural name
  */
  pluralize: function(resourceName) {
    var plurals = this.get('configurations.plurals');
    return (plurals && plurals[resourceName]) || resourceName + 's';
  },

  /**
    Registers custom attribute transforms.
    Fowards creation to serializer.
    @method registerTransform
  */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  }
});

/**
  The REST Adapter handles sending and fetching data to and from a REST API.

  @class RESTAdapter
  @namespace RESTless
  @extends RESTless.Adapter
*/
RESTless.RESTAdapter = RESTless.Adapter.extend({
  /**
    Serializer used to transform data.
    @property serializer
    @type RESTless.Serializer
    @default RESTless.JSONSerializer
   */
  serializer: RESTless.JSONSerializer.create(),

  /**
    Host url of the REST API if on a different domain than the app.
    @property host
    @type String
    @optional
    @example 'http://api.example.com'
   */
  host: oneWay('url'),
  /**
    Deprecated.
    @property url
    @type String
    @deprecated Use: `host`
   */
  url: null,

  /**
    API namespace endpoint path
    @property namespace
    @type String
    @optional
    @example 'api/v1'
   */
  namespace: null,

  /**
    If an API requires certain headers to be transmitted, e.g. an api key,
    you can add a hash of headers to be sent on each request.
    @property headers
    @type Object
    @optional
    @example '{ "X-API-KEY" : "abc1234" }'
    */
  headers: null,
  /**
    If an API requires paramters to be set on every request,
    e.g. an api key, you can add a hash of defaults.
    @property defaultData
    @type Object
    @optional
    @example '{ api_key: "abc1234" }'
    */
  defaultData: null,

  /**
    Adds content type extensions to requests.
    @property useContentTypeExtension
    @type Boolean
    @default false
    @example
      When `true` will make requests `/posts.json` instead of `/posts` or `/posts/115.json` instead of `/posts/115`
   */
  useContentTypeExtension: false,

  /**
    Computed path based on host and namespace.
    @property rootPath
    @type String
    @final
   */
  rootPath: computed(function() {
    var a = document.createElement('a'),
        host = this.get('host'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = host ? host : '/';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href.replace(/\/+$/, '');
  }).property('host', 'namespace'),

  /**
    Helper method creates a valid REST path to a resource
    @method resourcePath
    @param {String} resourceName Type of Model
    @return {String} the resource path
    @example App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return this.pluralize(Ember.String.decamelize(resourceName));
  },

  /**
    Creates and executes an ajax request wrapped in a promise.
    @method request
    @param {RESTless.Model} model model to use to build the request
    @param {Object} [params] Additional ajax params
    @param {Object} [key] optional resource primary key value
    @return {Ember.RSVP.Promise}
   */
  request: function(model, params, key) {
    var adapter = this,
        ajaxParams = this.prepareParams(params);
    ajaxParams.url = this.buildUrl(model, key);

    return new RSVPPromise(function(resolve, reject) {
      ajaxParams.success = function(data) {
        Ember.run(null, resolve, data);
      };
      ajaxParams.error = function(jqXHR, textStatus, errorThrown) {
        var errors = adapter.parseAjaxErrors(jqXHR, textStatus, errorThrown);
        Ember.run(null, reject, errors);
      };

      var ajax = Ember.$.ajax(ajaxParams);
      // (private) store current ajax request on the model.
      model.currentRequest = ajax;
    });
  },

  /**
    Builds ajax request parameters
    @method prepareParams
    @param {Object} [params] base ajax params
    @return {Object}
    @private
   */
  prepareParams: function(params) {
    var serializer = this.serializer,
        headers = this.get('headers'),
        defaultData = this.get('defaultData');
    params = params || {};
    params.dataType = serializer.dataType;
    params.contentType = serializer.contentType;
    if(headers) {
      params.headers = headers;
    }
    if(defaultData) {
      params.data = $.extend({}, defaultData, params.data);
    }
    if(params.data && params.type !== 'GET') {
      params.data = serializer.prepareData(params.data);
    }
    return params;
  },

  /**
    Constructs request url and dynamically adds the resource key if specified
    @method buildUrl
    @private
   */
  buildUrl: function(model, key) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath],
        dataType, url;

    if(key) {
      urlParts.push(key);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }
    url = urlParts.join('/');

    if(this.useContentTypeExtension) {
      dataType = this.serializer.dataType;
      if(dataType) {
        url += '.' + dataType;
      }
    }
    return url;
  },

  /**
    Saves a record. POSTs a new record, or PUTs an updated record to REST API
    @method saveRecord
    @param {RESTless.Model} record record to be saved
    @return {Ember.RSVP.Promise}
   */
  saveRecord: function(record) {
    var isNew = record.get('isNew'), method, ajaxPromise;
    //If an existing model isn't dirty, no need to save.
    if(!isNew && !record.get('isDirty')) {
      return new RSVPPromise(function(resolve, reject){
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

  /**
    Deletes a record from REST API using DELETE
    @method deleteRecord
    @param {RESTless.Model} record record to be deleted
    @return {Ember.RSVP.Promise}
   */
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

  /**
    Reloads a record from REST API
    @method reloadRecord
    @param {RESTless.Model} record record to be reloaded
    @return {Ember.RSVP.Promise}
   */
  reloadRecord: function(record) {
    var klass = record.constructor,
        primaryKey = get(klass, 'primaryKey'),
        key = record.get(primaryKey), ajaxPromise;

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(isNone(key)) {
      return new RSVPPromise(function(resolve, reject){
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

  /**
    Finds all records of specified class using GET
    @method findAll
    @param {RESTless.Model} klass model type to find
    @return {RESTless.RecordArray}
   */
  findAll: function(klass) {
    return this.findQuery(klass);
  },

  /**
    Finds records with specified query params using GET
    @method findQuery
    @param {RESTless.Model} klass model type to find
    @param {Object} queryParams hash of query params
    @return {RESTless.RecordArray}
   */
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

  /**
    Finds record with specified primary key using GET
    @method findByKey
    @param {RESTless.Model} klass model type to find
    @param {Number|String} key primary key value
    @param {Object} [queryParams] hash of additional query params
    @return {RESTless.Model}
   */
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

  /**
    Builds a robust error object using the serializer and xhr data
    @method parseAjaxErrors
    @private
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
  }
});

/**
  The Client is the top level store, housing the default adapter and configurations.
  The client will be automatically detected and set from your App namespace.
  Setting a client is optional and will automatically use a base client.

  @class Client
  @namespace RESTless
  @extends Ember.Object
*/
RESTless.Client = Ember.Object.extend({
  /**
    The default adapter for all models.
    @property adapter
    @type RESTless.Adapter
   */
  adapter: RESTless.RESTAdapter.create(),
  /**
    Shortcut alias to model configurations
    @private
  */
  _modelConfigs: oneWay('adapter.configurations.models')
});

Ember.Application.initializer({
  name: 'RESTless.Client',
  initialize: function(container, application) {
    var client = application.Client ? application.Client : RESTless.Client.create();
    RESTless.set('client', client);
    application.addObserver('Client', this, function() {
      RESTless.set('client', this.Client);
    });
  }
});

/**
  The State Mixin is responsible for keeping state and
  handling state events for Models.

  @class State
  @namespace RESTless
  @uses Ember.Evented
*/
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /**
    Model has not yet been saved; not yet assigned a primary key.
    @property isNew
    @type {Boolean}
  */
  isNew: true,
  /**
    Model has been retrieved and properties set.
    @property isLoaded
    @type {Boolean}
  */
  isLoaded: false,
  /**
    Model has changes that have not yet been saved.
    @property isDirty
    @type {Boolean}
  */
  isDirty: false,
  /**
    Model model is in the process of saving.
    @property isSaving
    @type {Boolean}
  */
  isSaving: false,
  /**
    Model model is in error state.
    @property isError
    @type {Boolean}
  */
  isError: false,

  /**
    Hash of current errors on model.
    @property errors
    @type Object
  */
  errors: null,

  /**
    Fired when the record is created.
    @event didCreate
  */
  didCreate: noop,
  /**
    Fired when the record is updated.
    @event didUpdate
  */
  didUpdate: noop,
  /**
    Fired when the record is enters the loaded state.
    @event didLoad
  */
  didLoad: noop,
  /**
    Fired when the record is deleted.
    @event didDelete
  */
  didDelete: noop,
  /**
    Fired when the record enters the error state.
    @event becameError
  */
  becameError: noop,

  /**
    Updates state and triggers events upon saving.
    @method onSaved
    @param {Boolean} wasNew was a new model prior to saving.
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

  /**
    Updates state and triggers events upon deletion.
    @method onDeleted
   */
  onDeleted: function() {
    this._triggerEvent('didDelete', this);
    Ember.run.next(this, function() {
      this.destroy();
    });
  },

  /**
    Updates state and triggers events upon loading.
    @method onLoaded
   */
  onLoaded: function() {
    this.setProperties({
      isDirty: false,
      isSaving: false,
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent('didLoad', this);
  },

  /**
    Updates state and triggers events upon an error.
    @method onError
   */
  onError: function(errors) {
    this.setProperties({
      isSaving: false,
      isError: true,
      errors: errors
    });
    this._triggerEvent('becameError', errors);
  },

  /**
    Clears errors and resets error state
    @method clearErrors
    @returns {Object}
   */
  clearErrors: function() {
    this.setProperties({ isError: false, errors: null });
    return this;
  },

  /**
    Copies the current state to a cloned object
    @method copyState
    @param {Object} clone the cloned object
    @returns {Object} the cloned object with copied state
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

  /**
    Flag for deferring dirty state when setting initial values on create() or load()
    @property _isReady
    @type {Boolean}
    @private
  */
  _isReady: false,

  /**
    Helper function to trigger events on models and to any listeners.
    @method _triggerEvent
    @private
  */
  _triggerEvent: function(event, data) {
    Ember.run(this, function() {
      Ember.tryInvoke(this, event, [data]);
      this.trigger(event, data);
    });
  }
});

/**
  The base model class for all RESTless objects.

  @class Model
  @namespace RESTless
  @extends Ember.Object
  @uses RESTless.State
  @uses Ember.Copyable
*/
RESTless.Model = Ember.Object.extend( RESTless.State, Ember.Copyable, {
  /** 
    A unique id number for the record. `id` is the default primary key.
    @property id
   */
  id: RESTless.attr('number'),

  /**
    Stores raw model data. Don't use directly; use declared model attributes.
    @private
   */
  __data: null,
  _data: computed(function() {
    if (!this.__data) { this.__data = {}; }
    return this.__data;
  }),

  /** 
    Hook to add observers for each attribute/relationship for 'isDirty' functionality
    @protected
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
    _onPropertyChange: called when any property of the model changes
    If the model has been loaded, or is new, isDirty flag is set to true.
    @private
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
    Called when a relationship property's isDirty state changes.
    Forwards a _onPropertyChange event for the parent object.
    @private
   */
  _onRelationshipChange: function(sender, key) {
    if(sender.get(key)) { // if isDirty
      this._onPropertyChange(key);
    }
  },

  /**
    Creates a clone of the model. Implements Ember.Copyable protocol
    <http://emberjs.com/api/classes/Ember.Copyable.html#method_copy>
    @method copy
    @param {Boolean} deep if `true`, a deep copy of the object should be made
    @return {Object} copy of receiver
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

  /**
    Creates a clone copy of the model along with it's current State.
    @method copyWithState
    @param {Boolean} deep if `true`, a deep copy of the object should be made
    @return {Object} copy of receiver
   */
  copyWithState: function(deep) {
    return this.copyState(this.copy(deep));
  },

  /**
    Saves the record using the model's adapter.
    @method saveRecord
    @chainable
  */
  saveRecord: function() {
    return get(this.constructor, 'adapter').saveRecord(this);
  },
  /**
    Deletes the record using the model's adapter.
    @method deleteRecord
    @chainable
  */
  deleteRecord: function() {
    return get(this.constructor, 'adapter').deleteRecord(this);
  },
  /**
    Reloads the record using the model's adapter.
    @method reloadRecord
    @chainable
  */
  reloadRecord: function() {
    return get(this.constructor, 'adapter').reloadRecord(this);
  },

  /**
    Serializes the record into its data representaion.
    @method serialize
    @param {Object} options hash of serialization options
    @chainable
  */
  serialize: function(options) {
    return RESTless.get('client.adapter.serializer').serialize(this, options);
  },
  /**
    Deserializes raw data into Model properties
    @method deserialize
    @param {Object} data raw data to deserialize
    @chainable
  */
  deserialize: function(data) {
    return RESTless.get('client.adapter.serializer').deserialize(this, data);
  },
  /**
    Serializes a Model property into its data representaion.
    @method serializeProperty
    @param {String} prop property key
    @chainable
  */
  serializeProperty: function(prop) {
    return RESTless.get('client.adapter.serializer').serializeProperty(this, prop);
  },
  /**
    Deserializes raw data property into Model property
    @method deserializeProperty
    @param {String} prop property key
    @param value property value
    @chainable
  */
  deserializeProperty: function(prop, value) {
    return RESTless.get('client.adapter.serializer').deserializeProperty(this, prop, value);
  }
});

/**
  Static properties and methods for the Model Class.

  @class Model
  @namespace RESTless
*/
RESTless.Model.reopenClass({
  /** 
    Extends super class `create` and marks _isReady state.
    @method create
    @return RESTless.Model
   */
  create: function() {
    var instance = this._super.apply(this, arguments);
    instance.set('_isReady', true);
    return instance;
  },
  /** 
    Alias to `create`. Eases transition to/from ember-data
    @deprecated Use `create`
    @method createRecord
    @return RESTless.Model
   */
  createRecord: Ember.aliasMethod('create'),

  /** 
    The adapter for the Model. Provides a hook for overriding.
    @property adapter
    @type RESTless.Adapter
   */
  adapter: computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /** 
    The property name for the primary key
    @property primaryKey
    @type String
    @default 'id'
   */
  primaryKey: computed(function() {
    var className = this.toString(),
        modelConfig = get(RESTless, 'client._modelConfigs').get(className);
    if(modelConfig && modelConfig.primaryKey) {
      return modelConfig.primaryKey;
    }
    return 'id';
  }).property('RESTless.client._modelConfigs'),

  /** 
    The name of the resource, derived from the class name.
    App.Post => 'Post', App.PostGroup => 'PostGroup', App.AnotherNamespace.Post => 'Post'

    @property resourceName
    @type String
   */
  resourceName: computed(function() {
    var classNameParts = this.toString().split('.');
    return classNameParts[classNameParts.length-1];
  }),
  /** 
    The plural name of the resource, derived from the class name.
    App.Post => 'Post', App.PostGroup => 'PostGroup', App.AnotherNamespace.Post => 'Post'

    @property resourceNamePlural
    @type String
   */
  resourceNamePlural: computed(function() {
    var resourceName = get(this, 'resourceName'),
        adapter = get(this, 'adapter');    
    return adapter.pluralize(Ember.String.decamelize(resourceName));
  }),

  /** 
    Meta information for all attributes and relationships
    @property fields
    @type Ember.Map
   */
  fields: computed(function() {
    var map = Ember.Map.create();
    this.eachComputedProperty(function(name, meta) {
      if (meta.isAttribute || meta.isRelationship) {
        map.set(name, meta);
      }
    });
    return map;
  }),

  /** 
    Find resources using the adapter.
    This method can handle all find types: `findAll`, `findQuery`, `findByKey`
    @method find
    @param {Object} params
    @return Object
   */
  find: function(params) {
    return get(this, 'adapter').find(this, params);
  },
  /** 
    Finds resources using the adapter, and returns a promise.
    @method fetch
    @param {Object} params hash of query params
    @return Ember.RSVP.Promise
   */
  fetch: function(params) {
    return get(this, 'adapter').fetch(this, params);
  },
  /** 
    Finds all resources of this type using the adapter.
    @method findAll
    @return Object
   */
  findAll: function() {
    return get(this, 'adapter').findAll(this);
  },
  /** 
    Find resources with query using the adapter.
    @method findQuery
    @param {Object} params hash of query params
    @return Object
   */
  findQuery: function(params) {
    return get(this, 'adapter').findQuery(this, params);
  },
  /** 
    Find resource with specified primary key using the adapter.
    @method findByKey
    @param {Number|String} key
    @param {Object} params any additional params
    @return Object
   */
  findByKey: function(key, params) {
    return get(this, 'adapter').findByKey(this, key, params);
  },
  /** 
    Find resource with specified id using the adapter.
    Keeps API similar to ember-data.
    @method findById
    @deprecated Use `findByKey`
   */
  findById: Ember.aliasMethod('findByKey'),

  /** 
    Create model directly from data representation.
    @method load
    @param {Object} data raw data to load
    @return RESTless.Model
   */
  load: function(data) {
    var model = this.create().set('_isReady', false).deserialize(data).set('_isReady', true);
    model.onLoaded();
    return model;
  },
  /** 
    Create collection of records directly from data representation..
    @method loadMany
    @param {Object} data raw data to load
    @return RESTless.RecordArray
   */
  loadMany: function(data) {
    var array = RESTless.RecordArray.create().deserializeMany(this, data);
    array.onLoaded();
    return array;
  }
});

/**
  A read-only model. Removes property change observers and write methods.
  Helps improve performance when write functionality is not needed.

  @class ReadOnlyModel
  @namespace RESTless
  @extends RESTless.Model
*/
RESTless.ReadOnlyModel = RESTless.Model.extend({
  serialize: null,
  saveRecord: null,
  deleteRecord: null,
  didDefineProperty: null,
  _onPropertyChange: noop
});

/**
  RecordArray is an Array of Model objects.

  @class RecordArray
  @namespace RESTless
  @extends Ember.ArrayProxy
  @uses RESTless.State
*/
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /**
    The default adapter for the RecordArray. Providing a hook for overriding.
    @property adapter
   */
  adapter: computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /**
    Use the current Serializer to turn the data into a record array.
    @method deserializeMany
    @param {Object} type The type of model class
    @param {Object} data The data to deserialize
    @returns RESTless.RecordArray
   */
  deserializeMany: function(type, data) {
    this._initContent();
    type = type || this.typeOfContent();
    return get(this, 'adapter.serializer').deserializeMany(this, type, data);
  },

  /**
    Use the current Serializer to turn the array into its data representation.
    @method serializeMany
    @param {Object} type The type of model class
    @returns RESTless.RecordArray
   */
  serializeMany: function(type) {
    type = type || this.typeOfContent();
    return get(this, 'adapter.serializer').serializeMany(this, type);
  },

  /**
    Overrides super replaceContent method to add isDirty functionality
    @method replaceContent
    @param {Number} idx The starting index
    @param {Number} amt The number of items to remove from the content.
    @param {Array} objects Optional array of objects to insert or null if no objects.
   */
  replaceContent: function(idx, amt, objects) {
    get(this, 'content').replace(idx, amt, objects);
    if (this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  },

  /**
    Returns the Class of records the RecordArray contains
    @method typeOfContent
    @returns Object type
   */
  typeOfContent: function() {
    var firstObj = this.objectAt(0);
    return firstObj && firstObj.constructor || null;
  },

  /**
    Helper to initialize the content property of the RecordArray if not present.
    @private
    @method _initContent
    @returns RecordArray this
   */
  _initContent: function() {
    if(!this.content) { 
      this.set('content', Ember.A());
    }
    return this;
  },

  /**
    Observes when items become dirty and sets itself to dirty.
    @private
   */
  _onItemDirtyChange: Ember.observer(function() {
    var clean = this.get('content').everyBy('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }, '@each.isDirty'),

  /**
    Observes when the array's isLoaded state changes and triggers each item's onLoaded.
    @private
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


RESTless.RecordArray.reopenClass({
  /**
    Creates a RecordArray
    @method create
    @returns RESTless.RecordArray
   */
  create: function() {
    var arr = this._super.apply(this, arguments);
    // override State defaults not implemented or applicable to arrays
    arr.setProperties({ _isReady: true, isNew: false });
    return arr;
  },
  /**
    Helper to create a RecordArray with it's content property initialized to an Array
    @method createWithContent
    @returns RESTless.RecordArray
   */
  createWithContent: function() {
    var arr = this.create.apply(this, arguments);
    return arr._initContent();
  }
});

/*
  Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
  © 2011 Colin Snover <http://zetafleet.com>
  Released under MIT license.
  Copied from: <https://raw.github.com/emberjs/data/master/packages/ember-data/lib/ext/date.js>
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
  The FixtureAdapter is used for working with predefined
  javascript data stored in memory.

  @class FixtureAdapter
  @beta
  @namespace RESTless
  @extends RESTless.Adapter
*/
RESTless.FixtureAdapter = RESTless.Adapter.extend({

  serializer: RESTless.JSONSerializer.create(),

  /**
    Saves a record. Pushes a new record to fixtures, or updates an existing record.
    @method saveRecord
    @param {RESTless.Model} record record to be saved
    @return {Ember.RSVP.Promise}
   */
  saveRecord: function(record) {
    var isNew = record.get('isNew'),
        fixtures = record.constructor.FIXTURES,
        primaryKey = get(record.constructor, 'primaryKey'),
        adapter = this, serializedRecord;

    if(!isNew && !record.get('isDirty')) {
      return new RSVPPromise(function(resolve, reject){
        resolve(record);
      });
    }

    record.set('isSaving', true);

    // If no fixtures for class, create
    if(!fixtures) {
      record.constructor.FIXTURES = fixtures = [];
    }

    // assign a guid for new records
    if(isNone(record.get(primaryKey))) {
      record.set(primaryKey, this.generateIdForRecord(record));
    }

    // serialize a to a flat record and include relationship data
    serializedRecord = record.serialize({ nonEmbedded: true, includeRelationships: true });

    return new RSVPPromise(function(resolve, reject){
      if(isNew) {
        // Push new records onto fixtures array
        fixtures.push(serializedRecord);
        record.onSaved(true);
        resolve(record);
      } else {
        // update existing record
        var index = adapter._findFixtureRecordIndex(record);
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
    return new RSVPPromise(function(resolve, reject){
      if(!record.constructor.FIXTURES) {
        record.onError();
        reject(null);
      }
      var index = adapter._findFixtureRecordIndex(record);
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
    var fixtures = klass.FIXTURES,
        result = null, fixturesA;

    if(!fixtures) {
      return result;
    }

    fixturesA = Ember.A(fixtures);
    if(queryParams) {
      fixturesA = fixturesA.filter(function(item, index, enumerable) {
        for(var key in queryParams) {
          if(queryParams.hasOwnProperty(key) && item[key] !== queryParams[key]) {
            return false;
          }
        }
        return true;
      });
    }
    
    result = RESTless.RecordArray.createWithContent();
    result.deserializeMany(klass.toString(), fixturesA);
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
    var fixtures = klass.FIXTURES,
        primaryKey = get(klass, 'primaryKey'),
        result = null, keyAsString, fixtureRecord;

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
    var klass = record.constructor,
        fixtures = klass.FIXTURES,
        primaryKey = get(klass, 'primaryKey'), fixtureRecord;
    if(fixtures) {
      fixtureRecord = fixtures.findProperty(primaryKey, record.get(primaryKey));
      return fixtures.indexOf(fixtureRecord);
    }
    return -1;
  }
});

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


})(this, jQuery, Ember);