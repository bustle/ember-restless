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
  initialize: function(registry, application) {
    var client = application.Client ? application.Client : Client.create();
    RESTless.set('client', client);
    application.addObserver('Client', application, function() {
      RESTless.set('client', application.Client);
    });
    RESTless.__container__ = application.__container__;
  }
});

export default Client;


