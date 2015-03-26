import Adapter from './adapter';
import JSONSerializer from '../serializers/json-serializer';
import RecordArray from '../model/record-array';

var RSVPPromise = Ember.RSVP.Promise;
var get = Ember.get;
var $ = Ember.$;

/**
  The REST Adapter handles sending and fetching data to and from a REST API.

  @class RESTAdapter
  @namespace RESTless
  @extends RESTless.Adapter
*/
var RESTAdapter = Adapter.extend({
  /**
    Serializer used to transform data.
    @property serializer
    @type RESTless.Serializer
    @default RESTless.JSONSerializer
   */
  serializer: JSONSerializer.create(),

  /**
    Host url of the REST API if on a different domain than the app.
    @property host
    @type String
    @optional
    @example 'http://api.example.com'
   */
  host: null,

  /**
    API namespace endpoint path
    @property namespace
    @type String
    @optional
    @example 'api/v1'
   */
  namespace: null,

  /**
    If an API requires certain headers to be transmitted, e.g. an api key,
    you can add a hash of headers to be sent on each request.
    @property headers
    @type Object
    @optional
    @example '{ 'X-API-KEY' : 'abc1234' }'
    */
  headers: null,
  
  /**
    If an API requires paramters to be set on every request,
    e.g. an api key, you can add a hash of defaults.
    @property defaultData
    @type Object
    @optional
    @example '{ api_key: 'abc1234' }'
    */
  defaultData: null,

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
    Root url path based on host and namespace.
    @property rootPath
    @type String
   */
  rootPath: Ember.computed(function() {
    var rootPath = this.get('host') || '/';
    var namespace = this.get('namespace');
    
    if (namespace) {
      if (rootPath.slice(-1) === '/') {
        rootPath = rootPath.slice(0, -1);
      }
      if (namespace.charAt(0) === '/') {
        namespace = namespace.slice(1);
      }
      rootPath = rootPath + '/' + namespace;
    }

    return rootPath.replace(/\/+$/, '');
  }).property('host', 'namespace'),

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
    Builds the url, params, and triggers an ajax request
    @param {Object} [options] hash of request options
    @return {Ember.RSVP.Promise}
   */
  request: function(options) {
    var klass = options.type || options.model.constructor;
    var ajaxParams = this.prepareParams(options.params);
    ajaxParams.url = this.buildUrl(options.model, options.key, klass);
    var ajax = this.ajax(ajaxParams);
    // store the ajax promise as 'currentRequest' on the model (private)
    options.model.currentRequest = ajax;
    return ajax;
  },

  /**
    Executes a jQuery ajax request wrapped in a promise.
    @param {Object} [options] hash of jQuery ajax options
    @return {Ember.RSVP.Promise}
   */
  ajax: function(options) {
    var adapter = this;
    return new RSVPPromise(function(resolve, reject) {
      options.success = function(data) {
        Ember.run(null, resolve, data);
      };
      options.error = function(jqXHR, textStatus, errorThrown) {
        var errors = adapter.parseAjaxErrors(jqXHR, textStatus, errorThrown);
        Ember.run(null, reject, errors);
      };
      $.ajax(options);
    });
  },

  /**
    Builds ajax request parameters
    @method prepareParams
    @param {Object} [params] base ajax params
    @return {Object}
    @private
   */
  prepareParams: function(params) {
    var serializer = this.serializer;
    var headers = this.get('headers');
    var defaultData = this.get('defaultData');
    
    params = params || {};
    params.type = params.type || 'GET';
    params.dataType = serializer.dataType;
    params.contentType = serializer.contentType;
    if(headers) {
      params.headers = headers;
    }
    if(defaultData) {
      params.data = $.extend({}, defaultData, params.data);
    }
    if(params.data && params.type !== 'GET') {
      params.data = serializer.prepareData(params.data);
    }
    return params;
  },

  /**
    Constructs request url and dynamically adds the resource key if specified
    @method buildURL
    @private
   */
  buildUrl: function(model, key, klass) {
    var resourcePath = this.resourcePath(get(klass, 'resourceName'));
    var primaryKey = get(klass, 'primaryKey');
    var urlParts = [this.get('rootPath'), resourcePath];
    var dataType, url;

    if(key) {
      urlParts.push(key);
    } else if(model.get(primaryKey)) {
      urlParts.push(model.get(primaryKey));
    }
    url = urlParts.join('/');

    if(this.useContentTypeExtension) {
      dataType = this.serializer.dataType;
      if(dataType) {
        url += '.' + dataType;
      }
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
    var isNew = record.get('isNew'), ajaxPromise;
    //If an existing model isn't dirty, no need to save.
    if(!isNew && !record.get('isDirty')) {
      return new RSVPPromise(function(resolve){
        resolve(record);
      });
    }

    record.set('isSaving', true);
    ajaxPromise = this.request({
      params: { type: isNew ? 'POST' : 'PUT', data: record.serialize() },
      model: record
    });

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
    var ajaxPromise = this.request({
      params: { type: 'DELETE', data: record.serialize() },
      model: record
    });

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
    var klass = record.constructor;
    var primaryKey = get(klass, 'primaryKey');
    var key = record.get(primaryKey), ajaxPromise;

    // Can't reload a record that hasn't been stored yet (no primary key)
    if(Ember.isNone(key)) {
      return new RSVPPromise(function(resolve, reject){
        reject(null);
      });
    }

    record.set('isLoaded', false);
    ajaxPromise = this.request({
      model: record,
      key: key
    });

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
    var array = RecordArray.createWithContent();
    var ajaxPromise = this.request({
      params: { data: queryParams },
      type : klass,
      model: array
    });

    ajaxPromise.then(function(data){
      array.deserializeMany(klass, data);
      array.onLoaded();
    }, function(error) {
      array.onError(error);
    });

    return array;
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
    var result = klass.create({ isNew: false });
    var ajaxPromise = this.request({
      params: { data: queryParams },
      model: result,
      key: key
    });

    ajaxPromise.then(function(data){
      result.deserialize(data);
      result.onLoaded();
    }, function(error) {
      result.onError(error);
    });

    return result;
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

export default RESTAdapter;
