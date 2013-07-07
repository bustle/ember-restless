var get = Ember.get, set = Ember.set,
    none = Ember.isNone, empty = Ember.isEmpty,
    RESTless;

function requiredMethod(name) {
  return function() { throw new Ember.Error(this.constructor.toString() + " must implement the required method: " + name); };
}

if (RESTless === undefined) {
  /**
   * Create RESTless as an Ember Namespace.
   *
   * @class RESTless
   * @static 
   */
  RESTless = Ember.Namespace.create();

  /**
   * Expose RESTless to the global window namespace.
   * Create shortcut alias 'RL'.
   */
  if (window !== undefined) {
    window.RL = window.RESTless = RESTless;
  }
}
