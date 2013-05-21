/*
 * RESTAdapter
 * Builds REST urls to resources
 * Builds and handles remote ajax requests
 */
RESTless.RESTAdapter = RESTless.Adapter.extend({
  /*
   * serializer: default to a JSON serializer
   */
  serializer: RESTless.JSONSerializer.create(),

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
   * rootPath: computed path based on url and namespace
   */
  rootPath: Ember.computed(function() {
    var a = document.createElement('a'),
        url = this.get('url'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = url ? url : '';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href;
  }).property('url', 'namespace'),

  /*
   * resourcePath: helper method creates a valid REST path to a resource
   * App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return Ember.String.decamelize(this.pluralize(resourceName));
  },

  /*
   * request: a wrapper around jQuery's ajax method
   * builds the url and dynamically adds the a resource key if specified
   */
  request: function(model, params, resourceKey) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath];

    if(resourceKey) {
      urlParts.push(resourceKey);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }
    params.url = urlParts.join('/');
    params.dataType = this.get('serializer.dataType');
    params.contentType = this.get('serializer.contentType');

    if(params.data && params.type !== 'GET') {
      params.data = this.get('serializer').prepareData(params.data);
    }

    var request = $.ajax(params);
    // Store a reference to the active request and destroy it when finished
    model.set('currentRequest', request);
    request.always(function() {
      model.set('currentRequest', null);
    });
    return request;
  },

  /*
   * saveRecord: POSTs a new record, or PUTs an updated record to REST service
   */
  saveRecord: function(record) {
    //If an existing model isn't dirty, no need to save.
    if(!record.get('isNew') && !record.get('isDirty')) {
      return $.Deferred().resolve();
    }
    record.set('isSaving', true);

    var isNew = record.get('isNew'), // purposely cache value for triggering correct event later
        method = isNew ? 'POST' : 'PUT',
        saveRequest = this.request(record, { type: method, data: record.serialize() }),
        self = this;

    saveRequest.done(function(data){
      if (data) {    // 204 No Content responses send no body
        record.deserialize(data);
      }
      record.clearErrors();
      record.set('isDirty', false);
      record._triggerEvent(isNew ? 'didCreate' : 'didUpdate');
    })
    .fail(function(jqxhr) {
      self._onError(record, jqxhr.responseText);
    })
    .always(function() {
      record.set('isSaving', false);
      record.set('isLoaded', true);
      record._triggerEvent('didLoad');
    });
    return saveRequest;
  },

  deleteRecord: function(record) {
    var deleteRequest = this.request(record, { type: 'DELETE', data: record.serialize() }),
        self = this;

    deleteRequest.done(function(){
      record._triggerEvent('didDelete');
      record.destroy();
    })
    .fail(function(jqxhr) {
      self._onError(record, jqxhr.responseText);
    });
    return deleteRequest;
  },

  find: function(model, params) {
    var primaryKey = get(model, 'primaryKey'),
        singleResourceRequest = typeof params === 'string' || typeof params === 'number' ||
                                (typeof params === 'object' && params.hasOwnProperty(primaryKey)), key;
    if(singleResourceRequest) {
      key = params.hasOwnProperty(primaryKey) ? params[primaryKey] : params;
      return this.findByKey(model, key);
    } else {
      return this.findAll(model, params);
    }
  },

  findAll: function(model, params) {
    var resourceInstance = model.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent({ type: model.toString() }),
        findRequest = this.request(resourceInstance, { type: 'GET', data: params }),
        self = this;

    findRequest.done(function(data){
      result.deserializeMany(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      self._onError(result, jqxhr.responseText);
    })
    .always(function() {
      result.set('isLoaded', true);
      result._triggerEvent('didLoad');
    });
    return result;
  },

  findByKey: function(model, key) {
    var result = model.create({ isNew: false }),
        findRequest = this.request(result, { type: 'GET' }, key),
        self = this;

    findRequest.done(function(data){
      result.deserialize(data);
      result.clearErrors();
    })
    .fail(function(jqxhr) {
      self._onError(result, jqxhr.responseText);
    })
    .always(function() {
      result.set('isLoaded', true);
      result._triggerEvent('didLoad');
    });
    return result;
  },

  /*
   * registerTransform: fowards custom tranform creation to serializer
   */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  },

  /* 
   * _onError: (private) helper method for handling error responses
   * Parses error json, sets error properties, and triggers error events
   */
  _onError: function(model, errorResponse) {
    var errorData = null;
    try { errorData = $.parseJSON(errorResponse); } catch(e){}
    model.setProperties({ 'isError': true, 'errors': errorData });
    model._triggerEvent('becameError');
  }
});
