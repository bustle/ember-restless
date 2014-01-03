/** 
  @module ember-restless
 */
var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    exports = Ember.exports || this,
    RESTless;

if ('undefined' === typeof RESTless) {
  /**
    All Ember RESTless functionality is defined inside of this namespace.
    @class RESTless
    @static
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.4.2'
  });

  /*
    A shortcut alias to the RESTless namespace.
    Similar to `Ember` and `Em`.
    Expose to global namespace.
   */
  exports.RL = exports.RESTless = RESTless;

  if (Ember.libraries) { 
    Ember.libraries.register('Ember RESTless', RESTless.VERSION);
  }
}
