var get = Ember.get, set = Ember.set;

module('RESTClient');

test('creating a client is optional', function() {
  ok( get(RESTless, 'client'), 'falls back to base client' );
});

test('a client can be created', function() {
  var client = RL.RESTClient.create();
  ok( client, 'a client exists' );
});

test('defining a custom client becomes the default client', function() {
  App.set('RESTClient', RL.RESTClient.create());
  equal( get(RESTless, 'client'), App.RESTClient, 'custom client becomes default' );
});