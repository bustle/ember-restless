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
