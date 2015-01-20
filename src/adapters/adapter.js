var get = Ember.get;
var merge = Ember.merge;
var RSVPPromise = Ember.RSVP.Promise;

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
    var primaryKey = get(klass, 'primaryKey'), key;
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
    var promise = new RSVPPromise(function(resolve, reject) {
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
    var primaryKey = get(klass, 'primaryKey');
    var key = record.get(primaryKey);

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(Ember.isNone(key)) {
      return new RSVPPromise(function(resolve, reject) {
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
        modelConfig = modelConfig ? merge(modelConfig, newConfig) : newConfig;
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

export default Adapter;
