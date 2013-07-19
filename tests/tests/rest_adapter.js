var get = Ember.get, set = Ember.set;

module('RESTAdapter');

test('can set a url', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com'
  });
  ok( adapter.get('rootPath').length, 'url applied to root path' );
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
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

test('various combinations of setting a namespace and/or url is resilient', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com/'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com/',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    url: 'http://api.com/',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
});

test('creates valid path for multi-word model classes', function() {
  var adapter = RL.RESTAdapter.create(),
      resourceName = get(App.PostGroup, 'resourceName');
  equal( adapter.resourcePath(resourceName), 'post_groups', 'resource path is valid' );
});

asyncTest('can optionally add query params to a findByKey request', 1, function() {
  var personFetch = App.Person.fetch({ id: 1, some_param: 'test' });
  personFetch._currentRequest.abort().always(function() {
    var urlParts = this.url.split('/');
    var path = urlParts[urlParts.length-1];
    equal( path, '1?some_param=test', 'findByKey with parameters requests expected url' );
    start();
  });
});

test('allows using content type extension', function() {
  var adapter = RL.RESTAdapter.create({
    useContentTypeExtension: true
  });
  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  var model = App.Post.create(),
      url = adapter.buildUrl(model),
      urlParts = url.split('/'),
      path = urlParts[urlParts.length-1];

  equal( path, 'posts.json', 'extension added' );

  url = adapter.buildUrl(model, 5);
  urlParts = url.split('/');
  path = [urlParts[urlParts.length-2], urlParts[urlParts.length-1]].join('/');

  equal( path, 'posts/5.json', 'extension added to key' );
});
