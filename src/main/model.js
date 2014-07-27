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
