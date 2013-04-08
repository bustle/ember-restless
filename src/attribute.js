/*
 * Attributes
 * Public interfaces to define model attributes
 */
(function() {

'use strict';

/*
 * RESTless._Attribute (internal)
 * Stores metadata about the property type for serialization
 */
RESTless._Attribute = Em.ObjectProxy.extend({
  type: null,
  belongsTo: false,
  hasMany: false,
  readOnly: false
});

/*
 * attr
 * Standard property
 */
RESTless.attr = function(type, opts) {
  opts = $.extend({ type: type }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * belongsTo
 * One-to-one relationship between two models
 */
RESTless.belongsTo = function(type, opts) {
  opts = $.extend({ type: type, belongsTo:true }, opts);
  return RESTless._Attribute.create(opts);
};

/*
 * hasMany
 * One-to-many & Many-to-many relationships
 */
RESTless.hasMany = function(type, opts) {
  opts = $.extend({ type: type, hasMany:true }, opts);
  return RESTless._Attribute.create(opts);
};

})();
