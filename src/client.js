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
  adapter: RESTless.RESTAdapter.create(),
  
  // Private shortcut aliases:
  _configs: Ember.computed.alias('adapter.configurations'),
  _pluralConfigs: Ember.computed.alias('adapter.configurations.plurals'),
  _modelConfigs: Ember.computed.alias('adapter.configurations.models')
});

Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'RESTClient',
    initialize: function(container, application) {
      // On app initialize, if custom RESTClient is present,
      // set that as the default client
      if(application.RESTClient) {
        RESTless.set('client', application.RESTClient);
      } else {
        // Set a default client
        RESTless.set('client', RESTless.RESTClient.create());
      }
      // Add an observer so you can set a client at a later date
      application.addObserver('RESTClient', this, function() {
        RESTless.set('client', this.RESTClient);
      });
    }
  });
});

})();
