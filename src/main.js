var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

function requiredMethod(name) {
  return function() { throw new Ember.Error(this.constructor.toString() + " must implement the required method: " + name); };
}

if (RESTless === undefined) {
  /**
   * Create RESTless as an Ember Namespace.
   * Track version and API revision number.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create({
    VERSION: '0.2.2',
    CURRENT_API_REVISION: 2
  });

  /**
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if (window !== undefined) {
    window.RL = window.RESTless = RESTless;
  }
}
