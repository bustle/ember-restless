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
