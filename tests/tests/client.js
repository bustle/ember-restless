var get = Ember.get, set = Ember.set;

module('RESTClient');

test('creating a client is optional', function() {
  ok( RESTless.get('client'), 'falls back to base client' );
});

test('a client can be created', function() {
  var client = RL.RESTClient.create();
  ok( client, 'a client exists' );
});

asyncTest('defining a custom client becomes the default client', function() {
  App = Ember.Application.create();
  App.RESTClient = RL.RESTClient.create();
  App.then(function(){
    equal( get(RESTless, 'client'), App.RESTClient, 'custom client becomes default' );
    start();
  });
});


