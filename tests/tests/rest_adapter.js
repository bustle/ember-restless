var get = Ember.get, set = Ember.set;

module('RESTAdapter');

test('can set a host', function() {
  var adapter = RL.RESTAdapter.create({
    host: 'http://api.com'
  });
  ok( adapter.get('rootPath').length, 'host applied to root path' );
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
});

test('can set a host using the deprecated url property', function() {
  var adapter = RL.RESTAdapter.create({
    url: 'http://api.com'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
});

test('can set a namespace', function() {
  var adapter = RL.RESTAdapter.create({
    namespace: 'v1'
  });
  ok( adapter.get('rootPath').length, 'namespace applied to root path' );
});

test('can set a namespace with host', function() {
  var adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
});

test('various combinations of setting a namespace and/or host is resilient', function() {
  var adapter = RL.RESTAdapter.create({
    host: 'http://api.com/'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    host: 'http://api.com'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    host: 'http://api.com',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    host: 'http://api.com',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'root path is valid' );
  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
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
  App.Person.find({ id: 1, some_param: 'test' }).currentRequest.abort().always(function() {
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

  App.Post.find().currentRequest.abort().fail(function() {
    var urlParts = this.url.split('/');
    var path = urlParts[urlParts.length-1];
    equal( path, 'posts.json', 'extension added' );
  });

  App.Post.find(5).currentRequest.abort().fail(function() {
    var urlParts = this.url.split('/');
    var path = [urlParts[urlParts.length-2], urlParts[urlParts.length-1]].join('/');
    equal( path, 'posts/5.json', 'extension added to key' );
  });
});

asyncTest('can optionally add headers to ajax requests', 1, function() {
  var adapter = RL.RESTAdapter.create({
    headers: { 'X-API-KEY': 'abc1234' }
  });
  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  App.Person.find(1).currentRequest.abort().always(function() {
    equal(this.headers['X-API-KEY'], 'abc1234', 'headers added correctly');
    start();
  });
});

asyncTest('can optionally add default parameters to ajax requests', 5, function() {
  var adapter = RL.RESTAdapter.create({
    defaultData: { api_key: 'abc1234' }
  });
  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  App.Person.find(1).currentRequest.abort().always(function() {
    var a = document.createElement('a');
    a.href = this.url;
    equal(a.search, '?api_key=abc1234', 'default data added');
  });

  App.Person.find({ id: 1, some_param: 'test' }).currentRequest.abort().always(function() {
    var a = document.createElement('a');
    a.href = this.url;
    equal(a.search, '?api_key=abc1234&some_param=test', 'default data merges with other params');
  });

  adapter.defaultData = { api_key: 'abc1234', some_param: 'foo' };

  App.Person.find(1).currentRequest.abort().always(function() {
    var a = document.createElement('a');
    a.href = this.url;
    equal(a.search, '?api_key=abc1234&some_param=foo', 'supports multiple default data properties');
  });

  App.Person.find({ id: 1, some_param: 'test' }).currentRequest.abort().always(function() {
    var a = document.createElement('a');
    a.href = this.url;
    equal(a.search, '?api_key=abc1234&some_param=test', 'query data has precedence over defaultData');
  });

  App.Person.find(1).currentRequest.abort().always(function() {
    var a = document.createElement('a');
    a.href = this.url;
    equal(a.search, '?api_key=abc1234&some_param=foo', 'default data should not be modified by prior queries');
    start();
  });
});
