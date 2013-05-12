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
   * Common serializer methods that must be implemented in a subclass
   */
  deserialize:         requiredMethod('deserialize'),
  deserializeProperty: requiredMethod('deserializeProperty'),
  deserializeMany:     requiredMethod('deserializeMany'),
  serialize:           requiredMethod('serialize'),
  serializeProperty:   requiredMethod('serializeProperty'),
  serializeMany:       requiredMethod('serializeMany'),

  /*
   * prepareData: (optional override) preps data before persisting
   */
  prepareData: function(data) {
    return data;
  }
});
