/**
  The Client is the top level store, housing the default adapter and configurations.
  The client will be automatically detected and set from your App namespace.
  Setting a client is optional and will automatically use a base client.

  @class Client
  @namespace RESTless
  @extends Ember.Object
*/
RESTless.Client = Ember.Object.extend({
  /**
    The default adapter for all models.
    @property adapter
    @type RESTless.Adapter
   */
  adapter: RESTless.RESTAdapter.create(),
  /**
    Shortcut alias to model configurations
    @private
  */
  _modelConfigs: oneWay('adapter.configurations.models')
});

Ember.Application.initializer({
  name: 'RESTless.Client',
  initialize: function(container, application) {
    var client = application.Client ? application.Client : RESTless.Client.create();
    RESTless.set('client', client);
    application.addObserver('Client', this, function() {
      RESTless.set('client', this.Client);
    });
  }
});
