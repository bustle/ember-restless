var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

if (RESTless === undefined) {
  /**
   * Create RESTless as an Ember Namespace.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create();

  RESTless.VERSION = '0.4.1';

  RESTless.toString = function() { return 'RESTless'; };

  /**
   * Export RESTless to the global (window) namespace.
   * Create shortcut alias 'RL'
   */
  var exports = Ember.exports || this;
  exports.RL = exports.RESTless = RESTless;

  /**
   * Register RESTless as a library.
   */
  if (Ember.libraries) { 
    Ember.libraries.register(RESTless.toString(), RESTless.VERSION);
  }
}
