/**
 * ember-restless
 * @overview A lightweight data persistence library for Ember.js
 * @version  0.7.3
 * @author   Garth Poitras <garth@bustle.com>
 * @license  MIT
 * Copyright (c) 2013-2015 Bustle Labs
 * Last modified: Mar 26, 2015
 */

(function(Ember, undefined) {

	'use strict';

  /**
    @module ember-restless
  */

  var libraries = Ember.libraries;
  var VERSION = '0.7.3';

  /**
    @class RESTless
    @static
  */
  var RESTless = Ember.Namespace.create({
    VERSION: VERSION
  });

  if (libraries) { 
    libraries.register('Ember RESTless', VERSION);
  }

  var Adapter__get = Ember.get;
  var Adapter__merge = Ember.merge;
  var Adapter__RSVPPromise = Ember.RSVP.Promise;

  /**
    Adapters handle sending and fetching data to and from a persistence layer.
    This is a base class to be subclassed. Subclasses should implement:
    `saveRecord()`, `deleteRecord()`, `findAll()`, `findQuery()`, `findByKey()`

    @class Adapter
    @namespace RESTless
    @extends Ember.Object
  */
  var Adapter = Ember.Object.extend({
    /**
      Instance of a Serializer used to transform data
      @property serializer
      @type RESTless.Serializer
     */
    serializer: null,

    /**
      Finds records with specified params.
      A convenience method that can be used to intelligently route to 
      ```findAll``` ```findQuery``` ```findByKey``` based on its params.
      @method find
      @param {Object} klass Model class type
      @param {Object} [params] a hash of params.
    */
    find: function(klass, params) {
      var primaryKey = Adapter__get(klass, 'primaryKey'), key;
      var typeofParams = typeof params;
      var singleResourceRequest = typeofParams === 'string' || typeofParams === 'number' || 
                                 (typeofParams === 'object' && params.hasOwnProperty(primaryKey));
      
      if(singleResourceRequest) {
        if(!params.hasOwnProperty(primaryKey)) {
          return this.findByKey(klass, params);
        }
        key = params[primaryKey];  
        delete params[primaryKey];
        return this.findByKey(klass, key, params);
      }
      return this.findQuery(klass, params);
    },

    /**
      Fetch wraps `find` in a promise for async find support.
      @method fetch
      @param {Object} klass Model class type
      @param {Object} [params] a hash of params.
      @return Ember.RSVP.Promise
    */
    fetch: function(klass, params) {
      var adapter = this, find;
      var promise = new Adapter__RSVPPromise(function(resolve, reject) {
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
      var klass = record.constructor;
      var primaryKey = Adapter__get(klass, 'primaryKey');
      var key = record.get(primaryKey);

      // Can't reload a record that hasn't been stored yet (no primary key)
      if(Ember.isNone(key)) {
        return new Adapter__RSVPPromise(function(resolve, reject) {
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
      var configs = this.get('configurations');
      var configForType = configs.get(type);
      if(configForType) {
        configs.set(type, Adapter__merge(configForType, value));
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
        <pre class='prettyprint'>
        App.Adapter.map('post', { primaryKey: 'slug' });
        App.Adapter.map('person', { lastName: { key: 'lastNameOfPerson' } });</pre>
    */
    map: function(modelKey, config) {
      var modelMap = this.get('configurations.models');
      // Temp supporting deprecated 'App.Post' style mapping
      var modelKeyParts = modelKey.split('.');
      var normalizedModelKey = Ember.String.camelize(modelKeyParts[modelKeyParts.length-1]);
      var modelConfig = modelMap.get(normalizedModelKey);
      var newConfig = {};
      var configKey, propertyKeys, modifiedPropKey;

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
          modelConfig = modelConfig ? Adapter__merge(modelConfig, newConfig) : newConfig;
        }
      }
      modelMap.set(normalizedModelKey, modelConfig);
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
      return plurals && plurals[resourceName] || resourceName + 's';
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

  var Serializer = Ember.Object.extend({
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
      Returns a model class for a particular type.
      @method modelFor
      @param {String or subclass of Model} type
      @return {subclass of Model}
    */
    modelFor: function(type) {
      if (typeof type === 'string') {
        // Globals support
        if (type.split('.').length > 1) {
          return Ember.get(Ember.lookup, type); 
        }

        // Container support
        return RESTless.__container__.lookupFactory('model:' + type);
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
    Base class for transforming data to/from persistence layer in the Adapter.
    Subclasses should implement `serialize` & `deserialize` methods.
    These are copied closely from ember-data:
    `https://github.com/emberjs/data/tree/master/packages/ember-data/lib/transforms`

    @class Transform
    @namespace RESTless
    @extends Ember.Object
   */
  var Transform = Ember.Object.extend({
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

  var isNone = Ember.isNone;

  var StringTransform = Transform.extend({
    deserialize: function(serialized) {
      return isNone(serialized) ? null : String(serialized);
    },
    serialize: function(deserialized) {
      return isNone(deserialized) ? null : String(deserialized);
    }
  });

  var isEmpty = Ember.isEmpty;

  var NumberTransform = Transform.extend({
    deserialize: function(serialized) {
      return isEmpty(serialized) ? null : Number(serialized);
    },
    serialize: function(deserialized) {
      return isEmpty(deserialized) ? null : Number(deserialized);
    }
  });

  var BooleanTransform = Transform.extend({
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

  var toISOString = Date.prototype.toISOString || function() {
    function pad(number) {
      if ( number < 10 ) {
        return '0' + number;
      }
      return number;
    }

    return this.getUTCFullYear() +
      '-' + pad( this.getUTCMonth() + 1 ) +
      '-' + pad( this.getUTCDate() ) +
      'T' + pad( this.getUTCHours() ) +
      ':' + pad( this.getUTCMinutes() ) +
      ':' + pad( this.getUTCSeconds() ) +
      '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
      'Z';
  };

  if (Ember.SHIM_ES5) {
    if (!Date.prototype.toISOString) {
      Date.prototype.toISOString = toISOString;
    }
  }

  var DateTransform = Transform.extend({
    deserialize: function(serialized) {
      var type = typeof serialized;

      if (type === 'string') {
        return new Date(Ember.Date.parse(serialized));
      } else if (type === 'number') {
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
        return toISOString.call(date);
      } else {
        return null;
      }
    }
  });

  var JSONTransforms = {
    'string'  : StringTransform.create(),
    'number'  : NumberTransform.create(),
    'boolean' : BooleanTransform.create(),
    'date'    : DateTransform.create()
  };

  var noop = Ember.K;

  /**
    The State Mixin is responsible for keeping state and
    handling state events for Models.

    @class State
    @namespace RESTless
    @uses Ember.Evented
  */
  var State = Ember.Mixin.create( Ember.Evented, {
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
      var mixins = State.mixins;
      var props = mixins[mixins.length-1].properties, p;
      
      Ember.beginPropertyChanges(clone);
      for(p in props) { 
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

  var ModelStateMixin = State;

  var RecordArray__get = Ember.get;

  /**
    RecordArray is an Array of Model objects.

    @class RecordArray
    @namespace RESTless
    @extends Ember.ArrayProxy
  */
  var RecordArray = Ember.ArrayProxy.extend( ModelStateMixin, {
    /**
      The default adapter for the RecordArray. Providing a hook for overriding.
      @property adapter
     */
    adapter: Ember.computed(function() {
      return RecordArray__get(RESTless, 'client.adapter');
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
      return RecordArray__get(this, 'adapter.serializer').deserializeMany(this, type, data);
    },

    /**
      Use the current Serializer to turn the array into its data representation.
      @method serializeMany
      @param {Object} type The type of model class
      @returns RESTless.RecordArray
     */
    serializeMany: function(type) {
      type = type || this.typeOfContent();
      return RecordArray__get(this, 'adapter.serializer').serializeMany(this, type);
    },

    /**
      Overrides super replaceContent method to add isDirty functionality
      @method replaceContent
      @param {Number} idx The starting index
      @param {Number} amt The number of items to remove from the content.
      @param {Array} objects Optional array of objects to insert or null if no objects.
     */
    replaceContent: function(idx, amt, objects) {
      RecordArray__get(this, 'content').replace(idx, amt, objects);
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
          if(Model.detectInstance(item)) {
            item.onLoaded();
          }
        });
      }
    }, 'isLoaded')
  });


  RecordArray.reopenClass({
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

  var attribute__merge = Ember.merge;

  /**
    Defines an attribute on a Model.
    Supports types: 'string', 'number', 'boolean', 'date'.

    @method attr
    @for RESTless
    @param {String} type the attribute type
    @param {Object} [opts] a hash of options
    @return {Ember.computed} attribute
  */
  function attr(type, opts) {
    var meta = attribute__merge({ type: type, isAttribute: true }, opts);
    return makeComputedAttribute(meta);
  }

  /**
    Defines a one-to-one relationship attribute on a Model.

    @method belongsTo
    @for RESTless
    @param {String} type the belongsTo Class type
    @param {Object} [opts] a hash of options
    @return {Ember.computed} attribute
  */
  function belongsTo(type, opts) {
    var meta = attribute__merge({ type: type, isRelationship: true, belongsTo: true }, opts);
    return makeComputedAttribute(meta);
  }

  /**
    Defines a one-to-many relationship attribute on a Model.

    @method hasMany
    @for RESTless
    @param {String} type the hasMany Class type
    @param {Object} [opts] a hash of options
    @return {Ember.computed} attribute
  */
  function hasMany(type, opts) {
    var defaultArray = function() {
      return RecordArray.createWithContent();
    },
    meta = attribute__merge({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
    return makeComputedAttribute(meta);
  }

  function makeComputedAttribute(meta) {
    return Ember.computed(function(key, value) {
      var data = this.get('_data');
      // Getter
      if (arguments.length === 1) {
        value = data[key];

        if (value === undefined) { 
          // Default values
          if (typeof meta.defaultValue === 'function') {
            value = meta.defaultValue.call(this);
          } else {
            value = meta.defaultValue;
          }
          data[key] = value;
        }
      }
      // Setter 
      else if (value !== data[key]) {
        data[key] = value;
        if (!meta.readOnly) {
          this._onPropertyChange(key);
        }
      }
      return value;
    }).property('_data').meta(meta);
  }

  var computed = Ember.computed;
  var Model__get = Ember.get;

  /**
    The base model class for all RESTless objects.

    @class Model
    @namespace RESTless
    @extends Ember.Object
    @uses Ember.Copyable
  */
  var Model = Ember.Object.extend( ModelStateMixin, Ember.Copyable, {
    /** 
      A unique id number for the record. `id` is the default primary key.
      @property id
     */
    id: attr('number'),

    /**
      Stores raw model data. Don't use directly; use declared model attributes.
      @private
     */
    __data: null,
    _data: computed(function() {
      if (!this.__data) { 
        this.__data = {};
      }
      return this.__data;
    }),

    /** 
      Hook to add observers for each attribute/relationship for 'isDirty' functionality
      @protected
     */
    didDefineProperty: function(proto, key, value) {
      if (value instanceof Ember.ComputedProperty) {
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
      if (isNew && Model__get(this.constructor, 'primaryKey') === key) {
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
      @return {Object} copy of receiver
     */
    copy: function() {
      var clone = this.constructor.create();
      var fields = Model__get(this.constructor, 'fields');
      var field, value;

      Ember.beginPropertyChanges(this);
      for (field in fields) {
        if (fields.hasOwnProperty(field)) {
          value = this.get(field);
          if (value !== null) {
            clone.set(field, value);
          }
        }
      }
      Ember.endPropertyChanges(this);

      return clone;
    },

    /**
      Creates a clone copy of the model along with it's current State.
      @method copyWithState
      @return {Object} copy of receiver
     */
    copyWithState: function() {
      return this.copyState(this.copy());
    },

    /**
      Saves the record using the model's adapter.
      @method saveRecord
      @chainable
    */
    saveRecord: function() {
      return Model__get(this.constructor, 'adapter').saveRecord(this);
    },
    /**
      Deletes the record using the model's adapter.
      @method deleteRecord
      @chainable
    */
    deleteRecord: function() {
      return Model__get(this.constructor, 'adapter').deleteRecord(this);
    },
    /**
      Reloads the record using the model's adapter.
      @method reloadRecord
      @chainable
    */
    reloadRecord: function() {
      return Model__get(this.constructor, 'adapter').reloadRecord(this);
    },

    /**
      Serializes the record into its data representaion.
      @method serialize
      @param {Object} options hash of serialization options
      @chainable
    */
    serialize: function(options) {
      return Model__get(this.constructor, 'adapter.serializer').serialize(this, options);
    },
    /**
      Deserializes raw data into Model properties
      @method deserialize
      @param {Object} data raw data to deserialize
      @chainable
    */
    deserialize: function(data) {
      return Model__get(this.constructor, 'adapter.serializer').deserialize(this, data);
    },
    /**
      Serializes a Model property into its data representaion.
      @method serializeProperty
      @param {String} prop property key
      @chainable
    */
    serializeProperty: function(prop) {
      return Model__get(this.constructor, 'adapter.serializer').serializeProperty(this, prop);
    },
    /**
      Deserializes raw data property into Model property
      @method deserializeProperty
      @param {String} prop property key
      @param value property value
      @chainable
    */
    deserializeProperty: function(prop, value) {
      return Model__get(this.constructor, 'adapter.serializer').deserializeProperty(this, prop, value);
    }
  });

  /**
    Static properties and methods for the Model Class.

    @class Model
    @namespace RESTless
  */
  Model.reopenClass({
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
      The adapter for the Model. Provides a hook for overriding.
      @property adapter
      @type RESTless.Adapter
     */
    adapter: computed(function() {
      return Model__get(RESTless, 'client.adapter');
    }).property('RESTless.client.adapter'),

    /** 
      The property name for the primary key
      @property primaryKey
      @type String
      @default 'id'
     */
    primaryKey: computed(function() {
      var modelConfig = Model__get(this, 'adapter.configurations.models'); 
      var configForKey = modelConfig && modelConfig.get(Model__get(this, '_configKey'));
      var primaryKey = configForKey && configForKey.primaryKey;
      return primaryKey || 'id';
    }).property('RESTless.client.adapter.configurations.models'),

    /** 
      The name of the resource, derived from the class name.
      App.Post => 'Post', App.PostGroup => 'PostGroup', App.AnotherNamespace.Post => 'Post'
      Note: when using ES6 modules, resourceName needs to be explicitly defined.

      @property resourceName
      @type String
     */
    resourceName: computed(function() {
      var classNameParts = this.toString().split('.');
      return classNameParts[classNameParts.length-1];
    }),
    /** 
      The plural name of the resource, derived from the class name.
      App.Post => 'posts', App.PostGroup => 'post_groups'

      @property resourceNamePlural
      @type String
     */
    resourceNamePlural: computed(function() {
      var resourceName = Model__get(this, 'resourceName');
      var adapter = Model__get(this, 'adapter');    
      return adapter.pluralize(Ember.String.decamelize(resourceName));
    }),

    /** 
      @property _configKey
      @type String
      @private
     */
    _configKey: computed(function() {
      return Ember.String.camelize(Model__get(this, 'resourceName'));
    }).property('resourceName'),

    /** 
      Meta information for all attributes and relationships
      @property fields
      @type Ember.Map
     */
    fields: computed(function() {
      var fields = {};
      this.eachComputedProperty(function(name, meta) {
        if (meta.isAttribute || meta.isRelationship) {
          fields[name] = meta;
        }
      });
      return fields;
    }),

    /** 
      Find resources using the adapter.
      This method can handle all find types: `findAll`, `findQuery`, `findByKey`
      @method find
      @param {Object} params
      @return Object
     */
    find: function(params) {
      return Model__get(this, 'adapter').find(this, params);
    },
    /** 
      Finds resources using the adapter, and returns a promise.
      @method fetch
      @param {Object} params hash of query params
      @return Ember.RSVP.Promise
     */
    fetch: function(params) {
      return Model__get(this, 'adapter').fetch(this, params);
    },
    /** 
      Finds all resources of this type using the adapter.
      @method findAll
      @return Object
     */
    findAll: function() {
      return Model__get(this, 'adapter').findAll(this);
    },
    /** 
      Find resources with query using the adapter.
      @method findQuery
      @param {Object} params hash of query params
      @return Object
     */
    findQuery: function(params) {
      return Model__get(this, 'adapter').findQuery(this, params);
    },
    /** 
      Find resource with specified primary key using the adapter.
      @method findByKey
      @param {Number|String} key
      @param {Object} params any additional params
      @return Object
     */
    findByKey: function(key, params) {
      return Model__get(this, 'adapter').findByKey(this, key, params);
    },

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
      var array = RecordArray.create().deserializeMany(this, data);
      array.onLoaded();
      return array;
    }
  });

  var JSONSerializer__get = Ember.get;

  /**
    Handles transforming json data to Models and Models to json data.

    @class JSONSerializer
    @namespace RESTless
    @extends RESTless.Serializer
  */
  var JSONSerializer = Serializer.extend({
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
      var key, prop, meta;

      if(!data) { 
        return resource;
      }

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
      var attrName = this.attributeNameForKey(resource.constructor, prop);
      var fields = JSONSerializer__get(resource.constructor, 'fields');
      var field = fields[attrName];
      var type, klass, belongsToModel, hasManyArr;

      // If the json contains a key not defined on the model, don't attempt to set it.
      if (!field) { 
        return; 
      }
      type = field.type;

      // If property is a hasMany relationship, deserialze the array
      if (field.hasMany) {
        hasManyArr = this.deserializeMany(resource.get(attrName), type, value);
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
        if (type && JSONTransforms[type]) {
          value = JSONTransforms[type].deserialize(value);
        }
        resource.set(attrName, value);
      }
    },

    /**
      Transforms json array into a record array
      @method deserializeMany
      @param {RESTless.RecordArray} recordArray RecordArray
      @param {Object} type class type of records
      @param {Object} data json data
      @return {RESTless.RecordArray}
    */
    deserializeMany: function(recordArray, type, data) {
      var arrayData, meta, i, len, item, content, klass;

      if(!data) { 
        return recordArray;
      }

      arrayData = this._arrayDataForType(type, data);
      if(!arrayData) { 
        return recordArray;
      }

      if(recordArray) {
        recordArray.set('isLoaded', false);
        recordArray.clear();
      } else {
        recordArray = RecordArray.createWithContent();
      }

      len = arrayData.length;
      if(len) {
        content = [];
        klass = this.modelFor(type);
        for(i = 0; i < len; i++) {
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
      if(meta) { 
        recordArray.set('meta', meta);
      }

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
      var fields, json, field, fieldMeta, value, wrapped;

      if(!resource) { 
        return null; 
      }

      fields = JSONSerializer__get(resource.constructor, 'fields');
      json = {};

      for (field in fields) {
        if (fields.hasOwnProperty(field)) {
          fieldMeta = fields[field];
          //Don't include readOnly properties or to-one relationships (unless specified)
          if (!fieldMeta.readOnly && (!fieldMeta.belongsTo || (fieldMeta.belongsTo && options && options.includeRelationships))) {
            value = this.serializeProperty(resource, field, fieldMeta);
            if(value !== null) {
              json[this.keyForAttributeName(field)] = value;
            }
          }
        }
      }

      // By default, serialzed records are wrapped in a resource-named object
      // { post: { id:1, name:'first post' } }
      // The option 'nonEmbedded' returns { id:1, name:'first post' }
      if(options && options.nonEmbedded) {
        return json;
      }
      wrapped = {};
      wrapped[this._keyForResource(resource)] = json;
      return wrapped;
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
      var type, value, transform;

      opts = opts || resource.constructor.metaForProperty(prop);
      type = opts.type;
      value = resource.get(prop);

      if (opts.hasMany) {
        return this.serializeMany(value, type);
      } else if (opts.belongsTo) {
        return this.serialize(value, { nonEmbedded: true });
      }

      //Check for a custom transform
      transform = JSONTransforms[type];
      if(opts.type && transform) {
        value = transform.serialize(value);
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
      var key = this._keyForResourceType(type);
      var array = recordArray.get('content');
      var len = array.length;
      var result = [], i, item;

      for(i = 0; i < len; i++) {
        item = array[i];
        if(Model.detectInstance(item)) {
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
      var modelConfig = JSONSerializer__get(klass, 'adapter.configurations.models');
      var configForKey = modelConfig && modelConfig.get(JSONSerializer__get(klass, '_configKey'));
      var keys = configForKey && configForKey.propertyKeys;
      if(keys && keys[key]) {
        return keys[key];
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
      try { 
        errorData = JSON.parse(error);
      } catch(e){}
      return errorData;
    },
    /**
      Attempts to extract metadata on json responses
      @method extractMeta
      @return Object
    */
    extractMeta: function(json) {
      return json && json.meta;
    },
    /**
      To register a custom attribute transform. Adds to JSONTransforms.
      @method registerTransform
      @param {String} type attribute type name
      @parma {Object} custom serialize and deserialize method hash
    */
    registerTransform: function(type, transform) {
      JSONTransforms[type] = transform;
    },

    /**
      @method _keyForResource
      @private
    */
    _keyForResource: function(resource) {
      return this.keyForResourceName(JSONSerializer__get(resource.constructor, 'resourceName'));
    },
    /**
      @method _keyForResourceType
      @private
    */
    _keyForResourceType: function(type) {
      var klass = this.modelFor(type);
      return klass ? this.keyForResourceName(JSONSerializer__get(klass, 'resourceName')) : 'model';
    },
    /**
      @method _keyPluralForResourceType
      @private
    */
    _keyPluralForResourceType: function(type) {
      var klass = this.modelFor(type);
      return klass ? JSONSerializer__get(klass, 'resourceNamePlural') : null;
    },
    /**
      Checks for wrapped array data by resource name: { posts: [...] }
      This is the default from ActiveRecord on direct finds
      @method _arrayDataForType
      @private
    */
    _arrayDataForType: function(type, data) {
      var keyPlural, dataForKey;
      if(Ember.isArray(data)) {
        return data;
      }

      keyPlural = this._keyPluralForResourceType(type);
      dataForKey = data[keyPlural];
      return dataForKey || null;
    }
  });

  var RESTAdapter__RSVPPromise = Ember.RSVP.Promise;
  var RESTAdapter__get = Ember.get;
  var $ = Ember.$;

  /**
    The REST Adapter handles sending and fetching data to and from a REST API.

    @class RESTAdapter
    @namespace RESTless
    @extends RESTless.Adapter
  */
  var RESTAdapter = Adapter.extend({
    /**
      Serializer used to transform data.
      @property serializer
      @type RESTless.Serializer
      @default RESTless.JSONSerializer
     */
    serializer: JSONSerializer.create(),

    /**
      Host url of the REST API if on a different domain than the app.
      @property host
      @type String
      @optional
      @example 'http://api.example.com'
     */
    host: null,

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
      @example '{ 'X-API-KEY' : 'abc1234' }'
      */
    headers: null,
    
    /**
      If an API requires paramters to be set on every request,
      e.g. an api key, you can add a hash of defaults.
      @property defaultData
      @type Object
      @optional
      @example '{ api_key: 'abc1234' }'
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
      Root url path based on host and namespace.
      @property rootPath
      @type String
     */
    rootPath: Ember.computed(function() {
      var rootPath = this.get('host') || '/';
      var namespace = this.get('namespace');
      
      if (namespace) {
        if (rootPath.slice(-1) === '/') {
          rootPath = rootPath.slice(0, -1);
        }
        if (namespace.charAt(0) === '/') {
          namespace = namespace.slice(1);
        }
        rootPath = rootPath + '/' + namespace;
      }

      return rootPath.replace(/\/+$/, '');
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
      Builds the url, params, and triggers an ajax request
      @param {Object} [options] hash of request options
      @return {Ember.RSVP.Promise}
     */
    request: function(options) {
      var klass = options.type || options.model.constructor;
      var ajaxParams = this.prepareParams(options.params);
      ajaxParams.url = this.buildUrl(options.model, options.key, klass);
      var ajax = this.ajax(ajaxParams);
      // store the ajax promise as 'currentRequest' on the model (private)
      options.model.currentRequest = ajax;
      return ajax;
    },

    /**
      Executes a jQuery ajax request wrapped in a promise.
      @param {Object} [options] hash of jQuery ajax options
      @return {Ember.RSVP.Promise}
     */
    ajax: function(options) {
      var adapter = this;
      return new RESTAdapter__RSVPPromise(function(resolve, reject) {
        options.success = function(data) {
          Ember.run(null, resolve, data);
        };
        options.error = function(jqXHR, textStatus, errorThrown) {
          var errors = adapter.parseAjaxErrors(jqXHR, textStatus, errorThrown);
          Ember.run(null, reject, errors);
        };
        $.ajax(options);
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
      var serializer = this.serializer;
      var headers = this.get('headers');
      var defaultData = this.get('defaultData');
      
      params = params || {};
      params.type = params.type || 'GET';
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
      @method buildURL
      @private
     */
    buildUrl: function(model, key, klass) {
      var resourcePath = this.resourcePath(RESTAdapter__get(klass, 'resourceName'));
      var primaryKey = RESTAdapter__get(klass, 'primaryKey');
      var urlParts = [this.get('rootPath'), resourcePath];
      var dataType, url;

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
      var isNew = record.get('isNew'), ajaxPromise;
      //If an existing model isn't dirty, no need to save.
      if(!isNew && !record.get('isDirty')) {
        return new RESTAdapter__RSVPPromise(function(resolve){
          resolve(record);
        });
      }

      record.set('isSaving', true);
      ajaxPromise = this.request({
        params: { type: isNew ? 'POST' : 'PUT', data: record.serialize() },
        model: record
      });

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
      var ajaxPromise = this.request({
        params: { type: 'DELETE', data: record.serialize() },
        model: record
      });

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
      var klass = record.constructor;
      var primaryKey = RESTAdapter__get(klass, 'primaryKey');
      var key = record.get(primaryKey), ajaxPromise;

      // Can't reload a record that hasn't been stored yet (no primary key)
      if(Ember.isNone(key)) {
        return new RESTAdapter__RSVPPromise(function(resolve, reject){
          reject(null);
        });
      }

      record.set('isLoaded', false);
      ajaxPromise = this.request({
        model: record,
        key: key
      });

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
      var array = RecordArray.createWithContent();
      var ajaxPromise = this.request({
        params: { data: queryParams },
        type : klass,
        model: array
      });

      ajaxPromise.then(function(data){
        array.deserializeMany(klass, data);
        array.onLoaded();
      }, function(error) {
        array.onError(error);
      });

      return array;
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
      var result = klass.create({ isNew: false });
      var ajaxPromise = this.request({
        params: { data: queryParams },
        model: result,
        key: key
      });

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

  var Client = Ember.Object.extend({
    /**
      The default adapter for all models.
      @property adapter
      @type RESTless.Adapter
     */
    adapter: RESTAdapter.create()
  });

  /*
    RESTless Client initializer
   */
  Ember.Application.initializer({
    name: 'RESTless.Client',
    initialize: function(container, application) {
      var client = application.Client ? application.Client : Client.create();
      RESTless.set('client', client);
      application.addObserver('Client', this, function() {
        RESTless.set('client', this.Client);
      });
      RESTless.__container__ = container;
    }
  });

  var ReadOnlyModel = Model.extend({
    serialize: null,
    saveRecord: null,
    deleteRecord: null,
    didDefineProperty: null,
    _onPropertyChange: Ember.K
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

  RESTless.Client = Client;
  RESTless.Adapter = Adapter;
  RESTless.RESTAdapter = RESTAdapter;
  RESTless.attr = attr;
  RESTless.belongsTo = belongsTo;
  RESTless.hasMany = hasMany;
  RESTless.Model = Model;
  RESTless.ReadOnlyModel = ReadOnlyModel;
  RESTless.RecordArray = RecordArray;
  RESTless.Serializer = Serializer;
  RESTless.JSONSerializer = JSONSerializer;
  RESTless.Transform = Transform;
  RESTless.BooleanTransform = BooleanTransform;
  RESTless.NumberTransform = NumberTransform;
  RESTless.StringTransform = StringTransform;
  RESTless.DateTransform = DateTransform;
  RESTless.JSONTransforms = JSONTransforms;

  var main = RESTless;

  var index__exports = Ember.lookup;
  index__exports.RL = index__exports.RESTless = main;

}(Ember));
