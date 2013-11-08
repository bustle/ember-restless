/*
 * JSONSerializer
 * Serializes and deserializes data to and from json
 */
RESTless.JSONSerializer = RESTless.Serializer.extend({

  dataType: 'json',
  contentType: 'application/json; charset=utf-8',

  /* 
   * deserialize: translates json object into a model object
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
    Ember.endPropertyChanges(resource);
    return resource;
  },

  /* 
   * deserializeProperty: sets model object properties from json
   */
  deserializeProperty: function(resource, prop, value) {
    var attrName = this.attributeNameForKey(resource, prop),
        fields = get(resource.constructor, 'fields'),
        field = fields.get(attrName), type, klass;

    // If the json contains a key not defined on the model, don't attempt to set it.
    if (!field) { return; }

    type = field.type;
    klass = get(Ember.lookup, type);

    // If property is a hasMany relationship, deserialze the array
    if (field.hasMany) {
      var hasManyArr = this.deserializeMany(resource.get(attrName), type, value);
      resource.set(attrName, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if (field.belongsTo && klass && value) {
      var belongsToModel = klass.create({ isNew: false, isLoaded: true }).deserialize(value);
      resource.set(attrName, belongsToModel);
    }
    else {
      // Check for a custom transform
      if (type && RESTless.JSONTransforms[type]) {
        value = RESTless.JSONTransforms[type].deserialize(value);
      }
      resource.set(attrName, value);
    }
  },

  /* 
   * deserializeMany: deserializes an array of json objects
   */
  deserializeMany: function(recordArray, type, data) {
    if(!data) { return recordArray; }

    var klass = get(Ember.lookup, type), meta, keyPlural, len, i, item;

    // extract any meta info
    meta = this.extractMeta(data);
    if(meta) { recordArray.set('meta', meta); }

    // Check for wrapped array by resource name: { posts: [...] }
    // This is the default from ActiveRecord on direct finds
    if(!Ember.isArray(data)) {
      keyPlural = this._keyPluralForResourceType(type);
      if(data[keyPlural]) {
        data = data[keyPlural];
      } else {
        return recordArray;
      }
    }

    if(recordArray) {
      recordArray.set('isLoaded', false);
      recordArray.clear();
    } else {
      recordArray = RESTless.RecordArray.createWithContent();
    }

    len = data.length;
    if(len) {
      Ember.beginPropertyChanges(recordArray);
      for(i=0; i<len; i++) {
        item = data[i];
        if(klass && typeof item === 'object') {
          item = klass.create({ isNew: false }).deserialize(item);
        }
        recordArray.pushObject(item);
      }
      Ember.endPropertyChanges(recordArray);
    }
    recordArray.set('isLoaded', true);
    return recordArray;
  },

  /* 
   * serialize: turns model into json
   */
  serialize: function(resource, options) {
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

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop, opts) {
    var value = resource.get(prop);

    if (!opts) {
      opts = resource.constructor.metaForProperty(prop);
    }
    if (opts && opts.hasMany) {
      return this.serializeMany(value.get('content'), opts.type);
    } else if(opts.belongsTo) {
      return this.serialize(value);
    }

    //Check for a custom transform
    if(opts.type && RESTless.JSONTransforms[opts.type]) {
      value = RESTless.JSONTransforms[opts.type].serialize(value);
    }
    return value;
  },

  /* 
   * serializeMany: serializes an array of models into json
   */
  serializeMany: function(recordArray, type) {
    var key = this._keyForResourceType(type),
        len = recordArray.length,
        result = [], i, item;
    for(i=0; i<len; i++) {
      item = recordArray[i];
      if(RESTless.Model.detectInstance(item)) {
        item = item.serialize();
      }
      result.push(item[key]);
    }
    return result;
  },

  /*
   * (private) shortcut helpers
   */
  _keyForResource: function(resource) {
    return this.keyForResourceName(get(resource.constructor, 'resourceName'));
  },
  _keyForResourceType: function(type) {
    var klass = get(Ember.lookup, type);
    return klass ? this.keyForResourceName(get(klass, 'resourceName')) : null;
  },
  _keyPluralForResourceType: function(type) {
    var klass = get(Ember.lookup, type);
    return klass ? get(klass, 'resourceNamePlural') : null;
  },
  /*
   * keyForResourceName: helper to transform resource name to valid json key
   */
  keyForResourceName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /*
   * keyForAttributeName: helper to transform attribute name to valid json key
   */
  keyForAttributeName: function(name) {
    return name ? Ember.String.decamelize(name) : null;
  },
  /*
   * attributeNameForKey: returns ember property name based on json key
   */
  attributeNameForKey: function(resource, key) {
    // check if a custom key was configured for this property
    var modelConfig = get(RESTless, 'client._modelConfigs').get(resource.constructor.toString());
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[key]) {
      return modelConfig.propertyKeys[key];
    }
    return Ember.String.camelize(key);
  },

  /* 
   * prepareData: json must be stringified before transmitting to most backends
   */
  prepareData: function(data) {
    return JSON.stringify(data);
  },
  /* 
   * parseError: transform error response text into json
   */
  parseError: function(error) {
    var errorData = null;
    try { errorData = JSON.parse(error); } catch(e){}
    return errorData;
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