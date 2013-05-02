var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

if ('undefined' === typeof RESTless) {
  /*
   * RESTless
   * Create as am Ember Namespace.
   * Track version and API revision number.
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.1.3',
    CURRENT_API_REVISION: 1
  });

  /*
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if ('undefined' !== typeof window) {
    window.RL = window.RESTless = RESTless;
  }
}
