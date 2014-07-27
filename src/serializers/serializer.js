/**
  Serializers handle transforming data to and from raw data and Models.
  This is a base class to be subclassed.

  @class Serializer
  @namespace RESTless
  @extends Ember.Object
*/
RESTless.Serializer = Ember.Object.extend({
  /**
    Type of data to serialize.
    @property dataType
    @type String
    @example json, jsonp, xml, html
  */
  dataType: null,
  /**
    Additional content type headers when transmitting data.
    @property dataType
    @type String
    @optional
  */
  contentType: null,

  /**
    Transforms raw data into model. Abstract - implement in subclass.
    @method deserialize
  */
  deserialize: noop,
  /**
    Transforms raw data property into model property. Abstract - implement in subclass.
    @method deserializeProperty
  */
  deserializeProperty: noop,
  /**
    Transforms array of raw data into record array. Abstract - implement in subclass.
    @method deserializeMany
  */
  deserializeMany: noop,
  /**
    Transforms model into raw data. Abstract - implement in subclass.
    @method serialize
  */
  serialize: noop,
  /**
    Transforms model property into raw data property. Abstract - implement in subclass.
    @method serializeProperty
  */
  serializeProperty: noop,
  /**
    Transforms a record array into raw data array. Abstract - implement in subclass.
    @method serializeMany
  */
  serializeMany: noop,
  /**
    To register a custom attribute transform. Abstract - implement in subclass.
    @method registerTransform
    @optional
  */
  registerTransform: noop,

  /**
    Returns a model class for a particular type.
    @method modelFor
    @param {String or subclass of RL.Model} type
    @return {subclass of RL.Model}
  */
  modelFor: function(type) {
    if (typeof type === 'string') {
      return get(Ember.lookup, type);
    }
    return type;
  },

  /**
    Optional override to prep data before persisting.
    @method prepareData
    @return Object
    @optional
  */
  prepareData: function(data) {
    return data;
  },
  /**
    Optional override to deserialize error messages.
    @method parseError
    @return Object
    @optional
  */
  parseError: function(error) {
    return error;
  }
});
