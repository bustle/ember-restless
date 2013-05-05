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
  deserialize:         mustImplement('deserialize'),
  deserializeProperty: mustImplement('deserializeProperty'),
  deserializeMany:     mustImplement('deserializeMany'),
  serialize:           mustImplement('serialize'),
  serializeProperty:   mustImplement('serializeProperty'),
  serializeMany:       mustImplement('serializeMany'),

  /*
   * Optional methods to override
   */
  /*
   * prepareData: preps data before persisting
   * i.e. a RESTAdapter with a JSONSerializer may need to JSON.stringify data before POSTing
   */
  prepareData: function(data) {
    return data;
  },
  /*
   * registerTransform: to add to the serializers transform hash
   */
  registerTransform: function(type, transform) { }
});
