import RESTless from '../src/main';
import FixtureAdapter from './fixture-adapter';
import LSAdapter from './ls-adapter';

/*
  Export public addon modules to namespace
*/
RESTless.FixtureAdapter = FixtureAdapter;
RESTless.LSAdapter = LSAdapter;

/*
  Expose to global namespace 
  and create shortcut alias `RL`
 */
var exports = Ember.lookup;
exports.RL = exports.RESTless = RESTless;
