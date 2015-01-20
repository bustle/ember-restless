import Serializer from './serializer';
import JSONTransforms from '../transforms/json';
import Model from '../model/model';
import RecordArray from '../model/record-array';

var get = Ember.get;

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
    var fields = get(resource.constructor, 'fields');
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

    fields = get(resource.constructor, 'fields');
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
    var modelConfig = get(klass, 'adapter.configurations.models');
    var configForKey = modelConfig && modelConfig.get(get(klass, '_configKey'));
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
    var keyPlural, dataForKey;
    if(Ember.isArray(data)) {
      return data;
    }

    keyPlural = this._keyPluralForResourceType(type);
    dataForKey = data[keyPlural];
    return dataForKey || null;
  }
});

export default JSONSerializer;
