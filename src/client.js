import RESTless from './core';
import RESTAdapter from './adapters/rest-adapter';

/**
  The Client is the top level store, housing the default adapter and configurations.
  The client will be automatically detected and set from your App namespace.
  Setting a client is optional and will automatically use a base client.

  @class Client
  @namespace RESTless
  @extends Ember.Object
*/
var Client = Ember.Object.extend({
  /**
    The default adapter for all models.
    @property adapter
    @type RESTless.Adapter
   */
  adapter: RESTAdapter.create()
});

/*
  RESTless Client initializer
 */
Ember.Application.initializer({
  name: 'RESTless.Client',
  initialize: function() {
    var application = arguments[1] || arguments[0]; // See: http://emberjs.com/deprecations/v2.x/#toc_deprecations-added-in-2-1
    var applicationClient = application.Client;
    RESTless.set('client', applicationClient ? applicationClient : Client.create());
    application.addObserver('Client', application, function() {
      RESTless.set('client', this.Client);
    });

    var container = application.__container__;
    RESTless.lookupFactory = function() {
      return container.lookupFactory.apply(container, arguments);
    };
  }
});

Ember.Application.instanceInitializer({
  name: 'RESTless.Client',
  initialize: function(applicationInstance) {
    RESTless.lookupFactory = function() {
      return applicationInstance._lookupFactory.apply(applicationInstance, arguments);
    };
  }
});

export default Client;
