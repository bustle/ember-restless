var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

if ('undefined' === typeof RESTless) {
  /**
   * Create RESTless as an Ember Namespace.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.4.1'
  });

  /**
   * Export RESTless to the global namespace.
   * Create shortcut alias 'RL'
   *
   * @class RL
   * @alias RESTless
   * @static 
   */
  var exports = Ember.exports || this;
  exports.RL = exports.RESTless = RESTless;

  if (Ember.libraries) { 
    Ember.libraries.register('Ember RESTless', RESTless.VERSION);
  }
}
