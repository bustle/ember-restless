/*
 * RESTless._Attribute (private)
 * Stores metadata about model property types
 */
RESTless._Attribute = Ember.ObjectProxy.extend({
  type: null,
  readOnly: false,
  belongsTo: false,
  hasMany: false,
  isRelationship: false
});

/*
 * Public attribute interfaces to define model properties
 */
// Standard property
RESTless.attr = function(type, opts) {
  opts = $.extend({ type: type }, opts);
  return RESTless._Attribute.create(opts);
};

// belongsTo: One-to-one relationship between two models
RESTless.belongsTo = function(type, opts) {
  opts = $.extend({ type: type, belongsTo:true, isRelationship:true }, opts);
  return RESTless._Attribute.create(opts);
};

// hasMany: One-to-many & many-to-many relationships
RESTless.hasMany = function(type, opts) {
  opts = $.extend({ type: type, hasMany:true, isRelationship:true }, opts);
  return RESTless._Attribute.create(opts);
};
