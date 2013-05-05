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
        modelConfig = get('RESTless.client._modelConfigs').get(className);
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
   * findAll: fetches all objects of this type with specified params
   */
  findAll: function(params) {
    return RESTless.get('client.adapter').findAll(this, params);
  },
  /*
   * findByKey: fetches object with specified key value
   */
  findByKey: function(key) {
    return RESTless.get('client.adapter').findByKey(this, key);
  },
  /*
   * find: alias to handle both findAll & findByKey
   */
  find: function(params) {
    return RESTless.get('client.adapter').find(this, params);
  }
});
