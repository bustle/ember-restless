/*
 * JSONSerializer
 * Serializes and deserializes data to and from json
 */
RESTless.JSONSerializer = RESTless.Serializer.extend({

  dataType: 'json',
  contentType: 'application/json; charset=utf-8',

  /* 
   * deserialize: translates json object into a model. i.e:
   * { id:1, name:'post 1' } => App.Post
   */
  deserialize: function(resource, data) {
    // Check if data is wrapped (ActiveRecord): { post: { id:1, name:'post 1' } }
    var key = this._keyForResource(resource), prop;
    if(data[key]) {
      data = data[key];
    }

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
    var modelConfig = get(RESTless, 'client._modelConfigs').get(resource.constructor.toString()), formattedProp;
 
    // check if a custom key was configured for this property
    if(modelConfig && modelConfig.propertyKeys && modelConfig.propertyKeys[prop]) {
      formattedProp = modelConfig.propertyKeys[prop];
    } else {
      formattedProp = Ember.String.camelize(prop);
    }

    var fields = get(resource.constructor, 'fields'),
        field = fields.get(formattedProp);

    // If the json contains a key not defined on the model, don't attempt to set it.
    if (!field) { return; }

    // If property is a hasMany relationship, deserialze the array
    if (field.hasMany) {
      var hasManyArr = this.deserializeMany(resource.get(formattedProp), field.type, value);
      resource.set(formattedProp, hasManyArr);
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if (field.belongsTo) {
      var belongsToModel = get(Ember.lookup, field.type).create({ isNew: false });
      this.deserialize(belongsToModel, value);
      resource.set(formattedProp, belongsToModel);
      belongsToModel.set('isLoaded', true);
    }
    else {
      // Check for a custom transform
      if (field.type && RESTless.JSONTransforms[field.type]) {
        value = RESTless.JSONTransforms[field.type].deserialize(value);
      }
      resource.set(formattedProp, value);
    }
  },

  /* 
   * deserializeMany: deserializes an array of json objects
   */
  deserializeMany: function(resource, type, data) {
    // extract any meta info
    var meta = this.extractMeta(data);
    if(meta) { resource.set('meta', meta); }

    // findAll from ActiveRecord returns array wrapped in plural resource name: { posts: [...] }
    if(!$.isArray(data)) {
      var keyPlural = get(RESTless, 'client.adapter').pluralize(this._keyForResourceType(type));
      data = data[keyPlural];
    }
    if(!data) { 
      return; 
    }

    var len = data.length,
        resourceArr = [], item, i;
    if(resource) {
      resource.clear();
    } else {
      resource = RESTless.RecordArray.createWithContent({type: type});
    }
    for(i=0; i<len; i++) {
      item = get(Ember.lookup, type).create({ isNew: false }).deserialize(data[i]);
      resourceArr.push(item);
    }
    if(resourceArr.length) {
      resource.pushObjects(resourceArr);
    }

    resource.set('isLoaded', true);

    return resource;
  },

  /* 
   * serialize: turns model into json
   */
  serialize: function(resource) {
    var key = this._keyForResource(resource),
        fields = get(resource.constructor, 'fields'),
        json = {};

    json[key] = {};
    fields.forEach(function(field, opts) {
      //Don't include readOnly properties or to-one relationships
      if (!opts.readOnly && !opts.belongsTo) {
        var val = this.serializeProperty(resource, field, opts);
        if(val !== null) {
          json[key][this.keyForAttributeName(field)] = val;
        }
      }
    }, this);

    return json;
  },

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop, opts) {
    var value = resource.get(prop);

    if (!opts) {
      opts = resource.constructor.metaForProperty(prop);
    }

    if (opts.hasMany) {
      return this.serializeMany(value.get('content'), opts.type);
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
  serializeMany: function(resourceArr, type) {
    var key = this._keyForResourceType(type),
        result = [],
        len = resourceArr.length, i, item;
    for(i=0; i<len; i++) {
      item = resourceArr[i].serialize();
      result.push(item[key]);
    }
    return result;
  },

  /*
   * _keyForResource, _keyForResourceType (private) shortcut helpers
   */
  _keyForResource: function(resource) {
    return this.keyForResourceName(get(resource.constructor, 'resourceName'));
  },
  _keyForResourceType: function(type) {
    return this._keyForResource(get(Ember.lookup, type).create());
  },

  /*
   * keyForResourceName: helper to transform resource name to valid json key
   */
  keyForResourceName: function(name) {
    return Ember.String.decamelize(name);
  },
  /*
   * keyForAttributeName: helper to transform attribute name to valid json key
   */
  keyForAttributeName: function(name) {
    return Ember.String.decamelize(name);
  },
  /* 
   * prepareData: json must be stringified before transmitting to most backends
   */
  prepareData: function(data) {
    return JSON.stringify(data);
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
