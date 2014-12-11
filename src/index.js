/** 
  @module ember-restless
 */
var get = Ember.get, set = Ember.set;
var isNone = Ember.isNone, isEmpty = Ember.isEmpty;
var computed = Ember.computed, reads = computed.reads;
var merge = Ember.merge, noop = Ember.K;
var RSVPPromise = Ember.RSVP.Promise;
var exports = Ember.exports || this;
var RESTless;

if ('undefined' === typeof RESTless) {
  /**
    All Ember RESTless functionality is defined inside of this namespace.
    @class RESTless
    @static
   */
  RESTless = Ember.Namespace.create({
    VERSION: '@@version'
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
