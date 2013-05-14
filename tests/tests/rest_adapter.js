var get = Ember.get, set = Ember.set;

module('RESTAdapter');

test('can set a url', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com/'
  });
  ok( adapter.get('rootPath').length, 'url applied to root path' );
  equal( adapter.get('rootPath'), adapter.get('url'), 'root path is valid' );
});

test('can set a namespace', function() {
  var adapter = RL.RESTAdapter.create({
    namespace: 'v1'
  });
  ok( adapter.get('rootPath').length, 'namespace applied to root path' );
});

test('can set a namespace with url', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com/',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
});

test('various formats of setting namespace with url is resilient', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is resilient' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com/',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is resilient' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is resilient' );
});

test('creates valid path for multi-word model classes', function() {
  var adapter = RL.RESTAdapter.create(),
      resourceName = get(App.PostGroup, 'resourceName');
  equal( adapter.resourcePath(resourceName), 'post_groups', 'resource path is valid' );
});
