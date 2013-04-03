/*
 * RESTAdapter
 * The base REST adapter
 * Core responsibilities include:
 * - storing the location and custom configurations of the remote REST service
 * - building ajax requests
 * - serializing ember models to json to send to backend
 * - deserializing json from backend into ember models
 */
(function() {

'use strict';

RESTless.RESTAdapter = Em.Object.extend({
  /*
   * url: base url of backend REST service
   * example: 'https://api.example.com'
   */
  url: null,

  /*
   * namespace: endpoint path
   * example: 'api/v1'
   */
  namespace: null,

  /*
   * configurations (not observable): hash of custom options to be used by a custom adapter
   * i.e. plurals - to set the plural resource name of 'person' to 'people'
   */
  configurations: {
    plurals: {}
  },

  /*
   * configure: method to set allowed configurations
   */
  configure: function(type, config) {
    var configs = this.get('configurations');
    if(configs[type]) {
      configs[type] = config;
    }
  },

  /*
   * rootPath: computed path based on url and namespace
   */
  rootPath: function() {
    var a = document.createElement('a'),
        url = this.get('url'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = url ? url : '';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href;
  }.property('url', 'namespace'),

  /*
   * request: a wrapper around jQuery's ajax method
   * builds the url and dynamically adds the a resource id if specified
   */
  request: function(params, resourceName, resourceId) {
    var urlParts = [this.get('rootPath'), resourceName];
    if(resourceId) {
      urlParts.push(resourceId);
    }
    params.url = urlParts.join('/');
    params.dataType = 'json';
    params.contentType = 'application/json; charset=utf-8';
    if(params.data && params.type !== 'GET') {
      params.data = JSON.stringify(params.data);
    }
    return $.ajax(params);
  },

  /* 
   * deserialize: translates json object into a model. i.e:
   * { id:1, name:'post 1' }
   */
  deserialize: function(resource, json) {
    Em.beginPropertyChanges(resource);
    var prop;
    for(prop in json) {
      if (json.hasOwnProperty(prop)) {
        this.deserializeProperty(resource, prop, json[prop]);
      }
    }
    Em.endPropertyChanges(resource);
    return resource;
  },

  /* 
   * deserializeProperty: sets model object properties from json
   */
  deserializeProperty: function(resource, prop, value) {
    var formattedProp = prop.camelize();
    // If the json contains a key not defined on the model, don't attempt to set it.
    if(Em.get(resource, formattedProp) === undefined) {
      return;
    }
    var attrMap = Em.get(resource.constructor, 'attributeMap'),
        attr = attrMap[formattedProp],
        attrType = attr.get('type');

    // If property is a hasMany relationship, deserialze the array
    if(attr.get('hasMany')) {
      var hasManyArr = this.deserializeMany(resource.get(formattedProp), attrType, value);
      // store a reference to the parent model on each item
      // when a property on an array item changes, the parent object can then be marked as dirty
      // TODO: find a cleaner way
      hasManyArr.forEach(function(item, i) {
        item.set('parentObject', resource);
      });
      resource.set(formattedProp, hasManyArr);
      return;
    } 
    // If property is a belongsTo relationship, deserialze that model
    else if(attr.get('belongsTo')) {
      var belongsToModel = Em.get(window, attrType).create();
      this.deserialize(belongsToModel, value);
      resource.set(formattedProp, belongsToModel);
      return;
    }
    
    // Check for a custom transform
    if(attrType && RESTless.JSONTransforms[attrType]) {
      value = RESTless.JSONTransforms[attrType].deserialize(value);
    }
    resource.set(formattedProp, value);
  },

  /* 
   * deserializeMany: deserializes an array of json objects for hasMany relationships
   */
  deserializeMany: function(resource, type, jsonArr) {
    var result = resource,
        len = jsonArr.length,
        resourceArr = [], item, i;
    if(result) {
      result.clear();
    } else {
      result = RESTless.RESTArray.createWithContent({type: type});
    }

    for(i=0; i<len; i++) {
      item = Em.get(window, type).create().deserialize(jsonArr[i]);
      resourceArr.push(item);
    }
    if(resourceArr.length) {
      result.pushObjects(resourceArr);
    }
    return result;
  },

  /* 
   * serialize: turns Em model into json to send to REST API
   */
  serialize: function(resource) {
    var resourceName = Em.get(resource.constructor, 'resourceName'),
        attrMap = Em.get(resource.constructor, 'attributeMap'),
        json = {},
        attr, val;

    json[resourceName] = {};
    for(attr in attrMap) {
      if (attrMap.hasOwnProperty(attr)) {
        val = this.serializeProperty(resource, attr);
        if(val !== null) {
          json[resourceName][attr.decamelize()] = val;
        }
      }
    }  
    return json;
  },

  /* 
   * serializeProperty: transform model property into json
   */
  serializeProperty: function(resource, prop) {
    var value = resource.get(prop),
        attrMap = Em.get(resource.constructor, 'attributeMap'),
        attr = attrMap[prop],
        attrType = attr.get('type');

    //Don't include to-one relationships
    if(attr.get('belongsTo')) {
      return null;
    }
    if(attr.get('hasMany')) {
      return this.serializeMany(value.get('content'), attrType);
    }

    //Check for a custom transform
    if(attrType && RESTless.JSONTransforms[attrType]) {
      value = RESTless.JSONTransforms[attrType].serialize(value);
    }
    return value;
  },

  /* 
   * serializeMany: serializes an array of json objects for hasMany relationships
   */
  serializeMany: function(resourceArr, type) {
    var resourceName = Em.get(Em.get(window, type), 'resourceName'),
        result = [],
        len = resourceArr.length,
        i;
    for(i=0; i<len; i++) {
      var item = resourceArr[i].serialize();
      result.push(item[resourceName]);
    }
    return result;
  },

  /*
   * registerTransform: adds a custom transform to JSONTransforms
   */
  registerTransform: function(type, transform) {
    Ember.assert("You are overwritting an existing transform: '" + type + "'", !RESTless.JSONTransforms[type]);
    RESTless.JSONTransforms[type] = transform;
  },

  /*
   * extractMeta: hook called on deserializtion
   * Overwrite this hook in your custom adapter to extract extra metadata from json
   */
  extractMeta: function(json) {
    if(json && json.meta) {
      return json.meta;
    }
  }
});

/*
 * JSONTransforms
 * Hash for custom json transforms
 * Bulding with transforms.js is optional, and will overwrite this
 */
RESTless.JSONTransforms = {};

})();
