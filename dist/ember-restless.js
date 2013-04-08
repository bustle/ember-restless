/*!
 * ember-restless
 * A lightweight data persistence library for Ember.js
 *
 * version: 0.1.1
 * last modifed: 2013-04-08
 *
 * Garth Poitras <garth22@gmail.com>
 * Copyright (c) 2013 Endless, Inc.
 */


/*
 * RESTless Namespace
 * Create a new Ember namespace and expose to the global namespace.
 * Track API revision number for future 'breaking changes' feature.
 */
(function() {

'use strict';

window.RESTless = Ember.Namespace.create({
  CURRENT_API_REVISION: 1
});

/*
 * Shorthand namespace: 'RL'
 */
window.RL = window.RESTless;

})();

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
   * serialize: turns Ember model into json to send to REST API
   */
  serialize: function(resource) {
    var resourceName = Em.get(resource.constructor, 'resourceName'),
        attrMap = Em.get(resource.constructor, 'attributeMap'),
        json = {},
        attr, val;

    json[resourceName] = {};
    for(attr in attrMap) {
      //Don't include readOnly properties or to-one relationships
      if (attrMap.hasOwnProperty(attr) && !attrMap[attr].get('readOnly') && !attrMap[attr].get('belongsTo')) {
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

/* RESTClient
 * Core interface that houses the REST adapter and revision of the API to target.
 * Setting a Client is optional and will automatically use a base client.
 *
 * You can define a custom client on your app like you would DS.Store in ember-data
 * Assign a revision number to be notified of breaking changes to the API
 */
(function() {

'use strict';

RESTless.RESTClient = Em.Object.extend({
  revision: RESTless.CURRENT_API_REVISION,
  adapter: RESTless.RESTAdapter.create()
});

// Set a default client
RESTless.set('client', RESTless.RESTClient.create());

// Detects 'RESTClient' on the Application implementaion namespace
// then sets that as the default client if found
// i.e. App.RESTClient = RESTless.RESTClient.create({ ... });
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'RESTClient',
    initialize: function(container, application) {
      if(application.RESTClient) {
        RESTless.set('client', application.RESTClient);
      }
    }
  });
});

})();

/*
 * Attributes
 * Public interfaces to define model attributes
 */
(function() {

'use strict';

/*
 * RESTless._Attribute (internal)
 * Stores metadata about the property type for serialization
 */
RESTless._Attribute = Em.ObjectProxy.extend({
  type: null,
  belongsTo: false,
  hasMany: false,
  readOnly: false
});

/*
 * attr
 * Standard property
 */
RESTless.attr = function(type, opts) {
  opts = $.extend({ type: type }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * belongsTo
 * One-to-one relationship between two models
 */
RESTless.belongsTo = function(type, opts) {
  opts = $.extend({ type: type, belongsTo:true }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * hasMany
 * One-to-many & Many-to-many relationships
 */
RESTless.hasMany = function(type, opts) {
  opts = $.extend({ type: type, hasMany:true }, opts);
  return RESTless._Attribute.create(opts);
};

})();

/*
 * State
 * Mixin for managing REST lifecycle state
 */
(function() {

'use strict';

RESTless.State = Em.Mixin.create( Em.Evented, {
  /* 
   * isLoaded: model has downloaded from REST service
   */
  isLoaded: false,
  /* 
   * isDirty: model has changes that have not yet been saved to REST service
   */
  isDirty: false,
  /* 
   * isSaving: model is in the process of saving to REST service
   */
  isSaving: false,
  /* 
   * isError: model has been marked as invalid after response from REST service
   */
  isError: false,
  /* 
   * errors: error message json returned from REST service
   */
  errors: null,

  /* 
   * clearErrors: (helper) reset isError flag, clear error messages
   */
  clearErrors: function() {
    this.setProperties({ 'isError': false, 'errors': null });
    return this;
  },

  /* 
   * copyState: copies the current state to a cloned object
   */
  copyState: function(clone) {
    return clone.setProperties({
      isLoaded: this.get('isLoaded'),
      isDirty:  this.get('isDirty'),
      isSaving: this.get('isSaving'),
      isError:  this.get('isError'),
      errors:   this.get('errors')
    });
  },

  /* 
   * _triggerEvent: (internal) helper method to trigger lifecycle events
   */
  _triggerEvent: function(name, data) {
    Em.run(this, function() {
      this.trigger(name, data);
    });
  },

  /* 
   * _onError: (internal) helper method for handling error responses
   * Parses error json, sets error properties, and triggers error events
   */
  _onError: function(errorResponse) {
    var errorJson;
    try { errorJson = $.parseJSON(errorResponse); } catch(e){}
    this.setProperties({ 'isError': true, 'errors': errorJson });
    this._triggerEvent('becameError', this.get('errors'));
  }
});

})();

/*
 * Non Observable
 * Mixin for models that don't need to be observed for property changes
 */
(function() {

'use strict';

RESTless.NonObservable = Em.Mixin.create({
  nonObservable: true
});

})();

/*
 * Model
 * Base class for RESTful models
 */
(function() {

'use strict';

RESTless.Model = Em.Object.extend( RESTless.State, Em.Copyable, {
  /* 
   * id: unique id number
   */
  id: RESTless.attr('number'),

  /*
   * currentRequest: stores the last ajax request as a property.
   * Useful for accessing the promise callbacks.
   * Automatically set to null when request completes
   */
  currentRequest: null,

  /* 
   * isNew: model has not yet been stored to REST service
   */
  isNew: function() {
    return !this.get('id');
  }.property('id'),

  /* 
   * init: on instance creation
   */
  init: function() {
    // Pre-fetch the attributeMap. Cached after 1 object of type is created
    var attributeMap = Em.get(this.constructor, 'attributeMap'),
        observable = !!!this.get('nonObservable'), attr;

    // Initialize relationships with proper model types.
    // Start observing *all* property changes for 'isDirty' functionality
    for(attr in attributeMap) {
      if (attributeMap.hasOwnProperty(attr)) {
        if(attributeMap[attr].get('hasMany')) {
          // create array of type & observe when contents of array changes
          this.set(attr, RESTless.RESTArray.createWithContent({type: attributeMap[attr].get('type')}));
          if(observable) { this.addObserver(attr+'.@each', this, this._onPropertyChange); }
        }
        else if(attributeMap[attr].get('belongsTo')) {
          // create model of type and observe when it changes
          this.set(attr, Em.get(window, attributeMap[attr].get('type')).create());
          if(observable) { this.addObserver(attr, this, this._onPropertyChange); }
        }
        else {
          if(observable) { this.addObserver(attr, this, this._onPropertyChange); }
        }
      }
    }
  },

  /* 
   * _onPropertyChange: (internal) called when any property of the model changes
   * If the model has been loaded from the REST service, or is new, isDirty flag is set to true.
   * If the property contains a 'parentObject' (hasMany array items), set the parent isDirty.
   */
  _onPropertyChange: function(sender, key) {
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
        attributeMap = Em.get(this.constructor, 'attributeMap'),
        attr, value;
        
    Em.beginPropertyChanges(this);
    for(attr in attributeMap) {
      if(attributeMap.hasOwnProperty(attr)) {
        value = this.get(attr);
        if(value !== null) { clone.set(attr, value); }
      }
    }
    Em.endPropertyChanges(this);
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
    var resourceName = Em.get(this.constructor, 'resourceName');
    return this.deserialize(json[resourceName]);
  },

  /*
   * request: returns an ajax request from the current Adapter.
   * Attemps to extract a resource id and keeps state of the currentRequest
   */
  request: function(params) {
    var resourceName = Em.get(this.constructor, 'resourceNamePlural'),
        resourceId = this.get('id'),
        self = this,
        request;

    if(!resourceId && params.data && params.data.id) {
      resourceId = params.data.id;
      delete params.data.id;
    }
    // Get the ajax request
    request = RESTless.get('client.adapter').request(params, resourceName, resourceId);

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
   * resourceName: path to the resource endpoint, determined from class name
   * i.e. MyApp.Post = RESTless.Model.extend({ ... })  =>  'post'
   */
  resourceName: function() {
    var constructorName = this.toString(),
        parts = constructorName.split('.'),
        resourceName = parts[parts.length-1].toLowerCase();
    return resourceName;
  }.property(),

  /*
   * resourceNamePlural: resourceName pluralized
   * Define custom plural words in a custom adapter
   */
  resourceNamePlural: function() {
    var name = Em.get(this, 'resourceName'),
        plurals = RESTless.get('client.adapter.configurations').plurals;
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
   * find: fetches a single resource with an id as the param.
   * Also an alias to findAll objects of this type with specified params
   */
  find: function(params) {
    var singleResourceRequest = typeof params === 'string' || typeof params === 'number';
    if(singleResourceRequest) {
      return this._findById(params);
    } else {
      return this.findAll(params);
    }
  },

  /*
   * findAll: fetches all objects of this type with specified params
   */
  findAll: function(params) {
    var self = this,
        resourceNamePlural = Em.get(this, 'resourceNamePlural'),
        resourceInstance = this.create(),
        result = RESTless.RESTArray.createWithContent(),
        findRequest = resourceInstance.request({ type: 'GET', data: params });

    findRequest.done(function(json){
      var items = json[resourceNamePlural].map(function(item) {
        return self.create().deserialize(item).set('isLoaded', true);
      });
      result.pushObjects(items);
      //call extract metadata hook
      var meta = RESTless.get('client.adapter').extractMeta(json);
      if(meta) { result.set('meta', meta); }
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
  },

  /*
   * _findById: (internal) fetches object with specified id
   * 'find' handles all cases, and reroutes to here if necessary
   */
  _findById: function(id) {
    var resourceName = Em.get(this, 'resourceName'),
        result = this.create(),
        findRequest = result.request({ type: 'GET', data: {id: id} });

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

})();

/*
 * RESTArray
 * Base class extention for RESTful arrays
 */
(function() {

'use strict';

RESTless.RESTArray = Em.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model the array contains
   */
  type: null,

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function(opts) {
    var type = this.get('type'), itemProto;
    if(type) {
      itemProto = Em.get(window, type) || Em.Object;
    }
    this.pushObject(itemProto.create(opts));
  }
});

/*
 * RESTArray (static)
 */
RESTless.RESTArray.reopenClass({
  /*
   * createWithContent: helper to create a RESTArray with the content property initialized
   */
  createWithContent: function(opts) {
    var mergedOpts = $.extend({ content: Em.A() }, opts);
    return RESTless.RESTArray.create(mergedOpts);
  }
});

})();

/*
 * JSONTransforms
 * Base serializers/deserializers for each attribute type
 *
 * This is an add-on, and is not necessary for RESTless to function
 *
 * Courtesy of ember-data
 * https://github.com/emberjs/data/blob/master/packages/ember-data/lib/transforms/json_transforms.js
 */
(function() {

'use strict';

var none = Ember.isNone;

RESTless.JSONTransforms = {
  string: {
    deserialize: function(serialized) {
      return none(serialized) ? null : String(serialized);
    },

    serialize: function(deserialized) {
      return none(deserialized) ? null : String(deserialized);
    }
  },

  number: {
    deserialize: function(serialized) {
      return none(serialized) ? null : Number(serialized);
    },

    serialize: function(deserialized) {
      return none(deserialized) ? null : Number(deserialized);
    }
  },

  // Handles the following boolean inputs:
  // "TrUe", "t", "f", "FALSE", 0, (non-zero), or boolean true/false
  'boolean': {
    deserialize: function(serialized) {
      var type = typeof serialized;

      if (type === "boolean") {
        return serialized;
      } else if (type === "string") {
        return serialized.match(/^true$|^t$|^1$/i) !== null;
      } else if (type === "number") {
        return serialized === 1;
      } else {
        return false;
      }
    },

    serialize: function(deserialized) {
      return Boolean(deserialized);
    }
  },

  date: {
    deserialize: function(serialized) {
      var type = typeof serialized;
      var date = null;

      if (type === "string" || type === "number") {
        // this is a fix for Safari 5.1.5 on Mac which does not accept timestamps as yyyy-mm-dd
        if (type === "string" && serialized.search(/^\d{4}-\d{2}-\d{2}$/) !== -1) {
          serialized += "T00:00:00Z";
        }

        date = new Date(serialized);

        // this is a fix for IE8 which does not accept timestamps in ISO 8601 format
        if (type === "string" && isNaN(date)) {
          date = new Date(Date.parse(serialized.replace(/\-/ig, '/').replace(/Z$/, '').split('.')[0]));
        }

        return date;
      } else if (serialized === null || serialized === undefined) {
        // if the value is not present in the data,
        // return undefined, not null.
        return serialized;
      } else {
        return null;
      }
    },

    serialize: function(date) {
      if (date instanceof Date) {
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        var pad = function(num) {
          return num < 10 ? "0"+num : ""+num;
        };

        var utcYear = date.getUTCFullYear(),
            utcMonth = date.getUTCMonth(),
            utcDayOfMonth = date.getUTCDate(),
            utcDay = date.getUTCDay(),
            utcHours = date.getUTCHours(),
            utcMinutes = date.getUTCMinutes(),
            utcSeconds = date.getUTCSeconds();


        var dayOfWeek = days[utcDay];
        var dayOfMonth = pad(utcDayOfMonth);
        var month = months[utcMonth];

        return dayOfWeek + ", " + dayOfMonth + " " + month + " " + utcYear + " " +
               pad(utcHours) + ":" + pad(utcMinutes) + ":" + pad(utcSeconds) + " GMT";
      } else {
        return null;
      }
    }
  }
};

})();
