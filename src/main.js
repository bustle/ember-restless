/*
 * RESTless Namespace
 * Create a new Ember namespace and expose to the global namespace.
 * Track API revision number for future 'breaking changes' feature.
 */
(function() {

'use strict';

window.RESTless = Ember.Namespace.create({
  VERSION: '0.1.3',
  CURRENT_API_REVISION: 1
});

/*
 * Shorthand namespace: 'RL'
 */
window.RL = window.RESTless;

})();
