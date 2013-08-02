var get = Ember.get, set = Ember.set;

module('JSONSerializer');

test('a json serialzer can be created', function() {
  var serialzer = RL.JSONSerializer.create();
  ok( serialzer, 'an serialzer exists' );
});

test('creates valid property names for multi-word model classes', function() {
  var serialzer = RL.JSONSerializer.create(),
      postGroup = App.PostGroup.create(),
      testJson = { post_group: { popular:[ { title: 'Test post' } ] } };

  postGroup.deserialize(testJson);
  equal( 1, postGroup.get('popular.length'), 'data deserialized' );
});

test('resource key lookups', function() {
  var serialzer = RL.JSONSerializer.create(),
      post = App.Post.create(),
      postGroup = App.PostGroup.create();

  RESTless.get('client.adapter').configure("plurals", {
    client_address: "client_addresses"
  });

  equal(serialzer.keyForResourceName('Post'), 'post', 'key correct');
  equal(serialzer.keyForResourceName('PostGroup'), 'post_group', 'key correct');

  equal(serialzer._keyForResource(post), 'post', 'key correct');
  equal(serialzer._keyForResource(postGroup), 'post_group', 'key correct');

  equal(serialzer._keyForResourceType('App.Post'), 'post', 'key correct');
  equal(serialzer._keyForResourceType('App.PostGroup'), 'post_group', 'key correct');

  equal(serialzer._keyPluralForResourceType('App.Post'), 'posts', 'key correct');
  equal(serialzer._keyPluralForResourceType('App.PostGroup'), 'post_groups', 'key correct');
  equal(serialzer._keyPluralForResourceType('App.ClientAddress'), 'client_addresses', 'key correct');

  equal(serialzer.keyForAttributeName('profile'), 'profile', 'key correct');
  equal(serialzer.keyForAttributeName('createdAt'), 'created_at', 'key correct');

  equal(serialzer.attributeNameForKey(post, 'title'), 'title', 'key correct');
  equal(serialzer.attributeNameForKey(post, 'created_at'), 'createdAt', 'key correct');
});
