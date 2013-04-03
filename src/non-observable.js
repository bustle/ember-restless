/*
 * Non Observable
 * Mixin for models that don't need to be observed for property changes
 */
(function() {

'use strict';

RESTless.NonObservable = Em.Mixin.create({
  nonObservable: true
});

})();
