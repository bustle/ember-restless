var get = Ember.get, set = Ember.set;

module('Client');

test('creating a client is optional', function() {
  ok( get(RESTless, 'client'), 'falls back to base client' );
});

test('a client can be created', function() {
  var client = RL.Client.create();
  ok( client, 'a client exists' );
});

test('defining a custom client becomes the default client', function() {
  App.set('Client', RL.Client.create());
  equal( get(RESTless, 'client'), App.Client, 'custom client becomes default' );
});