/*
 * Serializer
 * Base serializer to be subclassed.
 * Handles transforming data before saving to persistence layer
 * and transforming data into Models when retrieving
 */
RESTless.Serializer = Ember.Object.extend({
  /*
   * dataType: i.e. json, jsonp, xml, html
   */
  dataType: null,
  /*
   * contentType: additional content type headers
   */
  contentType: null,

  /* 
   * Common serializer methods to be implemented in a subclass
   */
  deserialize:         Ember.K,
  deserializeProperty: Ember.K,
  deserializeMany:     Ember.K,
  serialize:           Ember.K,
  serializeProperty:   Ember.K,
  serializeMany:       Ember.K,

  /*
   * prepareData: (optional override) preps data before persisting
   */
  prepareData: function(data) {
    return data;
  },
  /*
   * parseError: (optional override) deserialize error messages
   */
  parseError: function(error) {
    return error;
  }
});
