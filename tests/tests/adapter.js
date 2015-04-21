var get = Ember.get, set = Ember.set;

module('Adapter');

test('an adapter can be created', function() {
  var adapter = RL.Adapter.create();
  ok( adapter, 'an adapter exists' );
});

test('an adapter is optional with a custom client', function() {
  var client = RL.Client.create();
  ok( client.get('adapter'), 'falls back to base adapter' );
  ok( get(RESTless, 'client.adapter'), 'default client has base adapter' );
});

test('can change primary key for model property', function() {
  RESTless.get('client.adapter').map('post', {
    primaryKey: 'slug'
  });

  equal( get(RESTless, 'client.adapter.configurations.models').get('post').primaryKey, 'slug', 'primary key was changed' );
  equal( get(App.Post, 'adapter.configurations.models').get('post').primaryKey, 'slug', 'primary key was changed' );
  equal( get(App.Post, 'primaryKey'), 'slug', 'primaryKey property updated' );
});

test('can set custom model property key', function() {
  RESTless.get('client.adapter').map('post', {
    body: { key: 'bodyHtml' }
  });
  equal( get(App.Post, 'adapter.configurations.models').get('post').propertyKeys.bodyHtml, 'body', 'model property key was changed' );
});

test('can set multiple configurations at once and can overwrite configurations', function() {
  RESTless.get('client.adapter').map('post', {
    primaryKey: 'title',
    body: { key: 'bodyContent' }
  });
  equal( get(App.Post, 'adapter.configurations.models').get('post').primaryKey, 'title', 'primary key was changed' );
  equal( get(App.Post, 'adapter.configurations.models').get('post').propertyKeys.bodyContent, 'body', 'model property key was changed' );
});

test('support deprecated map using global namespace', function() {
  RESTless.get('client.adapter').map('App.Post', {
    primaryKey: 'slug'
  });
  equal( get(App.Post, 'adapter.configurations.models').get('post').primaryKey, 'slug', 'primary key was changed' );
  equal( get(App.Post, 'primaryKey'), 'slug', 'primaryKey property updated' );
});

test('can set custom plurals', function() {
  RESTless.get('client.adapter').configure('plurals', {
    person: 'people'
  });
  RESTless.get('client.adapter').configure('plurals', {
    nothing: 'something',
    another: 'to_test'
  });
  equal( get(RESTless, 'client.adapter.configurations.plurals').person, 'people', 'plural set and not overwritten' );
});
