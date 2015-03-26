var get = Ember.get, set = Ember.set;

module('RESTAdapter');

test('can set a host', function() {
  var adapter = RL.RESTAdapter.create({
    host: 'http://api.com'
  });
  ok( adapter.get('rootPath').length, 'host applied to root path' );
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
  var adapter = RL.RESTAdapter.create();
  equal( adapter.get('rootPath'), '', 'default path is blank' );

  adapter = RL.RESTAdapter.create({
    host: '/'
  });
  equal( adapter.get('rootPath'), '', 'slash host converted to blank. (slash is added when building full urls)' );

  adapter = RL.RESTAdapter.create({
    namespace: 'v1/'
  });
  equal( adapter.get('rootPath'), '/v1', 'works with just a namespace and transforms to correct format' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'removes trailing slash' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com'
  });
  equal( adapter.get('rootPath'), 'http://api.com', 'stays intact' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'joins namespace with single slash' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
    namespace: 'v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'joins namespace with single slash' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'joins namespace with single slash' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
    namespace: '/v1'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'joins namespace with single slash' );

  adapter = RL.RESTAdapter.create({
    host: 'http://api.com/',
    namespace: '/v1/'
  });
  equal( adapter.get('rootPath'), 'http://api.com/v1', 'removes trailing slash with namespace' );
});

test('creates valid path for multi-word model classes', function() {
  var adapter = RL.RESTAdapter.create(),
      resourceName = get(App.PostGroup, 'resourceName');
  equal( adapter.resourcePath(resourceName), 'post_groups', 'resource path is valid' );
});

test('can optionally add query params to a findByKey request', function() {
  var oldJQueryAjax = jQuery.ajax, ajaxHash;
  jQuery.ajax = function(hash) {
    ajaxHash = hash;
  };

  App.Comment.find({ id: 1, some_param: 'test' });
  equal (ajaxHash.url, '/comments/1', 'findByKey with parameters requests expected url');
  equal (JSON.stringify(ajaxHash.data), JSON.stringify({ some_param: 'test' }), 'findByKey with parameters requests expected query params');

  jQuery.ajax = oldJQueryAjax;
});

test('allows using content type extension', function() {
  var oldJQueryAjax = jQuery.ajax, ajaxHash;
  jQuery.ajax = function(hash) {
    ajaxHash = hash;
  };

  var adapter = RL.RESTAdapter.create({
    useContentTypeExtension: true
  });
  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  App.Post.find();
  equal (ajaxHash.url, '/posts.json', 'extension added');

  App.Post.find(5);
  equal (ajaxHash.url, '/posts/5.json', 'extension added to key');

  jQuery.ajax = oldJQueryAjax;
});

test('can optionally add headers to ajax requests', function() {
  var oldJQueryAjax = jQuery.ajax, ajaxHash;
  jQuery.ajax = function(hash) {
    ajaxHash = hash;
  };

  var adapter = RL.RESTAdapter.create({
    headers: { 'X-API-KEY': 'abc1234' }
  });
  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  App.Person.find();
  equal (ajaxHash.headers['X-API-KEY'], 'abc1234', 'headers added correctly');

  jQuery.ajax = oldJQueryAjax;
});

test('can optionally add default parameters to ajax requests', function() {
  var oldJQueryAjax = jQuery.ajax, ajaxHash;
  jQuery.ajax = function(hash) {
    ajaxHash = hash;
  };

  var defaultData = { api_key: 'abc1234' }, mergedData;
  var adapter = RL.RESTAdapter.create({
    defaultData: defaultData
  });

  App.set('Client', RL.Client.create({
    adapter: adapter
  }));

  App.Person.find(1);
  equal (JSON.stringify(ajaxHash.data), JSON.stringify(defaultData), 'default data added');

  App.Person.find({ id: 1, some_param: 'test' });
  mergedData = $.extend({}, defaultData, { some_param: 'test' });
  equal(JSON.stringify(ajaxHash.data), JSON.stringify(mergedData), 'default data merges with other params');

  adapter.defaultData = defaultData = { api_key: 'abc1234', some_param: 'foo' };

  App.Person.find(1);
  equal (JSON.stringify(ajaxHash.data), JSON.stringify(defaultData), 'supports multiple default data properties');

  App.Person.find({ id: 1, some_param: 'test' });
  equal (JSON.stringify(ajaxHash.data), JSON.stringify({ api_key: 'abc1234', some_param: 'test' }), 'query data has precedence over defaultData');

  App.Person.find(1);
  equal (JSON.stringify(ajaxHash.data), JSON.stringify(defaultData), 'default data should not be modified by prior queries');

  jQuery.ajax = oldJQueryAjax;
});
