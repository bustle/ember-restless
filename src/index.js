import RESTless from './main';

/*
  Expose to global namespace 
  and create shortcut alias `RL`
 */
var exports = Ember.lookup;
exports.RL = exports.RESTless = RESTless;
