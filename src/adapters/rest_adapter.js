/**
  The REST Adapter handles sending and fetching data to and from a REST API.

  @class RESTAdapter
  @namespace RESTless
  @extends RESTless.Adapter
*/
RESTless.RESTAdapter = RESTless.Adapter.extend({
  /**
    Serializer used to transform data.
    @property serializer
    @type RESTless.Serializer
    @default RESTless.JSONSerializer
   */
  serializer: RESTless.JSONSerializer.create(),

  /**
    Base url of REST API
    @property url
    @type String
    @example 'http://api.example.com'
   */
  url: null,
  /**
    API namespace endpoint path
    @property namespace
    @type String
    @optional
    @example 'api/v1'
   */
  namespace: null,
  /**
    Adds content type extensions to requests.
    @property useContentTypeExtension
    @type Boolean
    @default false
    @example
      When `true` will make requests `/posts.json` instead of `/posts` or `/posts/115.json` instead of `/posts/115`
   */
  useContentTypeExtension: false,

  /**
    Computed path based on url and namespace.
    @property rootPath
    @type String
    @final
   */
  rootPath: Ember.computed(function() {
    var a = document.createElement('a'),
        url = this.get('url'),
        ns = this.get('namespace'),
        rootReset = ns && ns.charAt(0) === '/';

    a.href = url ? url : '/';
    if(ns) {
      a.pathname = rootReset ? ns : (a.pathname + ns);
    }
    return a.href.replace(/\/+$/, '');
  }).property('url', 'namespace'),

  /**
    Helper method creates a valid REST path to a resource
    @method resourcePath
    @param {String} resourceName Type of Model
    @return {String} the resource path
    @example App.Post => 'posts',  App.PostGroup => 'post_groups'
   */
  resourcePath: function(resourceName) {
    return this.pluralize(Ember.String.decamelize(resourceName));
  },

  /**
    Creates and executes an ajax request wrapped in a promise.
    @method request
    @param {RESTless.Model} model model to use to build the request
    @param {Object} [params] Additional ajax params
    @param {Object} [key] optional resource primary key value
    @return {Ember.RSVP.Promise}
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

  /**
    Constructs request url and dynamically adds the resource key if specified
    @method buildUrl
    @private
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

  /**
    Saves a record. POSTs a new record, or PUTs an updated record to REST API
    @method saveRecord
    @param {RESTless.Model} record record to be saved
    @return {Ember.RSVP.Promise}
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

  /**
    Deletes a record from REST API using DELETE
    @method deleteRecord
    @param {RESTless.Model} record record to be deleted
    @return {Ember.RSVP.Promise}
   */
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

  /**
    Reloads a record from REST API
    @method reloadRecord
    @param {RESTless.Model} record record to be reloaded
    @return {Ember.RSVP.Promise}
   */
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

  /**
    Finds all records of specified class using GET
    @method findAll
    @param {RESTless.Model} klass model type to find
    @return {RESTless.RecordArray}
   */
  findAll: function(klass) {
    return this.findQuery(klass);
  },

  /**
    Finds records with specified query params using GET
    @method findQuery
    @param {RESTless.Model} klass model type to find
    @param {Object} queryParams hash of query params
    @return {RESTless.RecordArray}
   */
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

  /**
    Finds record with specified primary key using GET
    @method findByKey
    @param {RESTless.Model} klass model type to find
    @param {Number|String} key primary key value
    @param {Object} [queryParams] hash of additional query params
    @return {RESTless.Model}
   */
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

  /**
    Fetch wraps `find` in a promise for async find support.
    @method fetch
    @param {Object} klass Model class type
    @param {Object} [params] a hash of query params.
    @return Ember.RSVP.Promise
  */
  fetch: function(klass, params) {
    var promise = this._super(klass, params);
    // private: store the current ajax request for aborting, etc.
    // depreciate: _currentRequest now that find access is directly available.
    promise._currentRequest = promise._find.get('currentRequest');
    return promise;
  },

  /**
    Registers custom attribute transforms.
    Fowards creation to serializer.
    @method registerTransform
  */
  registerTransform: function(type, transform) {
    this.get('serializer').registerTransform(type, transform);
  },

  /**
    Builds a robust error object using the serializer and xhr data
    @method parseAjaxErrors
    @private
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
  }
});
