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
  hasMany: false
});

/*
 * attr
 * Standard property
 */
RESTless.attr = function(type) {
  return RESTless._Attribute.create({ type: type });
};

/*
 * belongsTo
 * One-to-one relationship between two models
 */
RESTless.belongsTo = function(type) {
  return RESTless._Attribute.create({ type: type, belongsTo:true });
};

/*
 * hasMany
 * One-to-many & Many-to-many relationships
 */
RESTless.hasMany = function(type) {
  return RESTless._Attribute.create({ type: type, hasMany:true });
};

})();
