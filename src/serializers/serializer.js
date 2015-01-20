import RESTless from '../core';

/**
  Serializers handle transforming data to and from raw data and Models.
  This is a base class to be subclassed. Subclasses should implement:
  `deserialize()`, `deserializeProperty()`, `deserializeMany()`, `serialize()`, `serializeProperty()`, `serializeMany()`

  @class Serializer
  @namespace RESTless
  @extends Ember.Object
*/
var Serializer = Ember.Object.extend({
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
    Returns a model class for a particular type.
    @method modelFor
    @param {String or subclass of Model} type
    @return {subclass of Model}
  */
  modelFor: function(type) {
    if (typeof type === 'string') {
      // Globals support
      if (type.split('.').length > 1) {
        return Ember.get(Ember.lookup, type); 
      }

      // Container support
      return RESTless.__container__.lookupFactory('model:' + type);
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

export default Serializer;
