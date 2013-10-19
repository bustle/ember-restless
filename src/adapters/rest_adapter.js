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
   * request: creates and executes an ajax request wrapped in a promise
   */
  request: function(model, params, key) {
    var adapter = this, serializer = this.serializer;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      params = params || {};
      params.url = adapter.buildUrl(model, key);
      params.dataType = serializer.dataType;
      params.contentType = serializer.contentType;

      if(params.data && params.type !== 'GET') {
        params.data = serializer.prepareData(params.data);
      }

      params.success = function(data, textStatus, jqXHR) {
        Ember.run(null, resolve, data);
      };
      params.error = function(jqXHR, textStatus, errorThrown) {
        var errors = adapter.parseAjaxErrors(jqXHR, textStatus, errorThrown);
        Ember.run(null, reject, errors);
      };

      var ajax = Ember.$.ajax(params);

      // (private) store current ajax request on the model.
      model.set('currentRequest', ajax);
    });
  },

  /*
   * buildUrl (private): constructs request url and dynamically adds the resource key if specified
   */
  buildUrl: function(model, key) {
    var resourcePath = this.resourcePath(get(model.constructor, 'resourceName')),
        primaryKey = get(model.constructor, 'primaryKey'),
        urlParts = [this.get('rootPath'), resourcePath],
        dataType = this.get('serializer.dataType'), url;

    if(key) {
      urlParts.push(key);
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
    var isNew = record.get('isNew'), method, ajaxPromise;
    //If an existing model isn't dirty, no need to save.
    if(!isNew && !record.get('isDirty')) {
      return new Ember.RSVP.Promise(function(resolve, reject){
        resolve(record);
      });
    }

    record.set('isSaving', true);
    method = isNew ? 'POST' : 'PUT';
    ajaxPromise = this.request(record, { type: method, data: record.serialize() });

    ajaxPromise.then(function(data){
      if(data) {
        record.deserialize(data);
      }
      record.onSaved(isNew);
      return record;
    }, function(error) {
      record.onError(error);
      return error;
    });

    return ajaxPromise;
  },

  deleteRecord: function(record) {
    var ajaxPromise = this.request(record, { type: 'DELETE', data: record.serialize() });

    ajaxPromise.then(function() {
      record.onDeleted();
      return null;
    }, function(error) {
      record.onError(error);
      return error;
    });

    return ajaxPromise;
  },

  reloadRecord: function(record) {
    var klass = record.constructor,
        primaryKey = get(klass, 'primaryKey'),
        key = record.get(primaryKey), ajaxPromise;

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(Ember.isNone(key)) {
      return new Ember.RSVP.Promise(function(resolve, reject){
        reject(null);
      });
    }

    record.set('isLoaded', false);
    ajaxPromise = this.request(record, { type: 'GET' }, key);
    ajaxPromise.then(function(data){
      record.deserialize(data);
      record.onLoaded();
    }, function(error) {
      record.onError(error);
    });

    return ajaxPromise;
  },

  findAll: function(klass) {
    return this.findQuery(klass);
  },

  findQuery: function(klass, queryParams) {
    var type = klass.toString(),
        resourceInstance = klass.create({ isNew: false }),
        result = RESTless.RecordArray.createWithContent(),
        ajaxPromise = this.request(resourceInstance, { type: 'GET', data: queryParams });

    ajaxPromise.then(function(data){
      result.deserializeMany(type, data);
      result.onLoaded();
    }, function(error) {
      result.onError(error);
    });

    return result;
  },

  findByKey: function(klass, key, queryParams) {
    var result = klass.create({ isNew: false }),
        ajaxPromise = this.request(result, { type: 'GET', data: queryParams }, key);

    ajaxPromise.then(function(data){
      result.deserialize(data);
      result.onLoaded();
    }, function(error) {
      result.onError(error);
    });

    return result;
  },

  /*
   * fetch: wraps find method in a promise for async find support
   */
  fetch: function(klass, params) {
    var promise = this._super(klass, params);
    // private: store the current ajax request for aborting, etc.
    // depreciate: _currentRequest now that find access is directly available.
    promise._currentRequest = promise._find.get('currentRequest');
    return promise;
  },

  /*
   * parseAjaxErrors: builds a robust error object using the serializer and xhr data
   */
  parseAjaxErrors: function(jqXHR, textStatus, errorThrown) {
    // use serializer to parse error messages from server
    var errors = this.get('serializer').parseError(jqXHR.responseText) || {};
    // add additional xhr error info
    errors.status = jqXHR.status;
    errors.state = jqXHR.state();
    errors.textStatus = textStatus;
    errors.errorThrown = errorThrown;
    return errors;
  },

  /*
   * registerTransform: fowards custom tranform creation to serializer
   */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  }
});
