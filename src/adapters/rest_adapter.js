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
   * useContentTypeExtension: forces content type extensions on resource requests
   * i.e. /posts.json vs /posts | /posts/115.json vs /posts/115
   * Useful for conforming to 3rd party apis
   * or returning correct content-type headers with Rails caching
   */
  useContentTypeExtension: false,

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
    return a.href.replace(/\/+$/, '');
  }).property('url', 'namespace'),

  /*
   * resourcePath: helper method creates a valid REST path to a resource
   * App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return this.pluralize(Ember.String.decamelize(resourceName));
  },

  /*
   * request: configures and returns an ajax request
   */
  request: function(model, params, resourceKey) {
    params.url = this.buildUrl(model, resourceKey);
    params.dataType = this.get('serializer.dataType');
    params.contentType = this.get('serializer.contentType');

    if(params.data && params.type !== 'GET') {
      params.data = this.get('serializer').prepareData(params.data);
    }

    var request = $.ajax(params);
    model.set('currentRequest', request);
    return request;
  },

  /*
   * buildUrl (private): constructs request url and dynamically adds the a resource key if specified
   */
  buildUrl: function(model, resourceKey) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath],
        dataType = this.get('serializer.dataType'), url;

    if(resourceKey) {
      urlParts.push(resourceKey);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }

    url = urlParts.join('/');
    if(this.get('useContentTypeExtension') && dataType) {
      url += '.' + dataType;
    }
    return url;
  },

  /*
   * saveRecord: POSTs a new record, or PUTs an updated record to REST service
   */
  saveRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        isNew = record.get('isNew');
    //If an existing model isn't dirty, no need to save.
    if(!isNew && !record.get('isDirty')) {
      deferred.resolve(record);
      return deferred.promise;
    }

    record.set('isSaving', true);

    var method = isNew ? 'POST' : 'PUT',
        ajaxRequest = this.request(record, { type: method, data: record.serialize() }),
        self = this;

    ajaxRequest.done(function(data){
      if (data) {
        record.deserialize(data);
      }
      record.onSaved(isNew);
      deferred.resolve(record);
    })
    .fail(function(xhr) {
      record.onError(self.onXhrError(xhr));
      deferred.reject(record.get('errors'));
    });

    return deferred.promise;
  },

  deleteRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        ajaxRequest = this.request(record, { type: 'DELETE', data: record.serialize() }),
        self = this;

    ajaxRequest.done(function() {
      record.onDeleted();
      deferred.resolve();
    })
    .fail(function(xhr) {
      record.onError(self.onXhrError(xhr));
      deferred.reject(record.get('errors'));
    });

    return deferred.promise;
  },

  reloadRecord: function(record) {
    var deferred = Ember.RSVP.defer(),
        primaryKey = get(record.constructor, 'primaryKey'),
        key = record.get(primaryKey),
        self = this, ajaxRequest;

    if(Ember.isNone(key)) {
      deferred.reject(null);
      return deferred.promise;
    }

    record.set('isLoading', true);
    ajaxRequest = this.request(record, { type: 'GET' }, key);
    ajaxRequest.done(function(data){
      if (data) {
        record.deserialize(data);
      }
      record.onLoaded();
      deferred.resolve(record);
    })
    .fail(function(xhr) {
      record.onError(self.onXhrError(xhr));
      deferred.reject(record.get('errors'));
    });

    return deferred.promise;
  },

  findAll: function(model) {
    return this.findQuery(model, null);
  },

  findQuery: function(model, queryParams) {
    var resourceInstance = model.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent({ type: model.toString() }),
        ajaxRequest = this.request(resourceInstance, { type: 'GET', data: queryParams }),
        self = this;

    ajaxRequest.done(function(data){
      result.deserializeMany(data);
      result.onLoaded();
    })
    .fail(function(xhr) {
      result.onError(self.onXhrError(xhr));
    });

    return result;
  },

  findByKey: function(model, key, queryParams) {
    var result = model.create({ isNew: false }),
        ajaxRequest = this.request(result, { type: 'GET', data: queryParams }, key),
        self = this;

    ajaxRequest.done(function(data){
      result.deserialize(data);
      result.onLoaded();
    })
    .fail(function(xhr) {
      result.onError(self.onXhrError(xhr));
    });

    return result;
  },

  /*
   * onXhrError: use serializer to parse ajax errors
   */
  onXhrError: function(xhr) {
    return this.get('serializer').parseError(xhr.responseText);
  },

  /*
   * registerTransform: fowards custom tranform creation to serializer
   */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  }
});
