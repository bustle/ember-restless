/* RESTClient
 * Core interface that houses the REST adapter and revision of the API to target.
 * Setting a Client is optional and will automatically use a base client.
 *
 * You can define a custom client on your app like you would DS.Store in ember-data
 * Assign a revision number to be notified of breaking changes to the API
 */
(function() {

'use strict';

RESTless.RESTClient = Em.Object.extend({
  revision: RESTless.CURRENT_API_REVISION,
  adapter: function(key, value) {
    if (arguments.length === 1) {
      return RESTless.RESTAdapter.create();
    } else {
      //Allow the adapter to be set by Class or string
      if(typeof value === 'string') {
        var adapterClass = Em.get(window, value);
        Ember.assert('The adapter of type: "' + value + '" was not found.', adapterClass);
        return adapterClass;
      }
      return value;
    }
  }.property()
});

// Set a default client
RESTless.set('client', RESTless.RESTClient.create());

// Detects 'RESTClient' on the Application implementaion namespace
// then sets that as the default client if found
// i.e. App.RESTClient = RESTless.RESTClient.create({ ... });
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'RESTClient',
    initialize: function(container, application) {
      if(application.RESTClient) {
        RESTless.set('client', application.RESTClient);
      }
    }
  });
});

})();
