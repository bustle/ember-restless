/**
 * Client
 * You can define a custom Client on your app like you would DS.Store in ember-data.
 * The client will be automatically detected and set from your App namespace.
 * Setting a Client is optional and will automatically use a base Client.
 *
 * @class Client
 * @namespace RESTless
 * @extends Ember.Object
 */
RESTless.Client = Ember.Object.extend({
  revision: RESTless.CURRENT_API_REVISION,
  adapter: RESTless.RESTAdapter.create(),
  // Private shortcut aliases:
  _configs: Ember.computed.alias('adapter.configurations'),
  _modelConfigs: Ember.computed.alias('adapter.configurations.models')
});

Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: 'Client',
    initialize: function(container, application) {
      // On app initialize, if custom Client is present,
      // set that as the default client
      if(application.Client) {
        RESTless.set('client', application.Client);
      } else {
        // Set a default client
        RESTless.set('client', RESTless.Client.create());
      }
      // Add an observer so you can set a client at a later date
      application.addObserver('Client', this, function() {
        RESTless.set('client', this.Client);
      });
    }
  });
});

/* Deprecate warning for RESTClient, since it is a crucial first step for customization */
RESTless.RESTClient = RESTless.Client.extend({
  init: function() {
    Ember.deprecate("RESTClient is deprecated. Please use Client instead.");
    this._super();
  }
});
