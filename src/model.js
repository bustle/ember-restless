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
   * resourceName: helper to extract name of model subclass
   * App.Post => 'Post', App.PostGroup => 'PostGroup', App.AnotherNamespace.Post => 'Post'
   */
  resourceName: function() {
    var classNameParts = this.toString().split('.');
    return classNameParts[classNameParts.length-1];
  }.property(),

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
