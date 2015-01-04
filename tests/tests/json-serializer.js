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

test('null belongsTo relationship values do not create empty models', function() {
  var serialzer = RL.JSONSerializer.create(),
      comment = App.Comment.create(),
      testJson = { comment: { id: 1, text: 'hello', post: null } };

  comment.deserialize(testJson);

  equal( 'hello', comment.get('text') );
  equal( null ,   comment.get('post') );
  equal( null ,   comment.get('author') );
});

test('deserializing into an existing record array triggers isLoaded observer', function() {
  var serializer = RL.JSONSerializer.create(),
      testJson = [ { name: 'tag1' }, { name: 'tag2' } ],
      arr = App.Tag.loadMany(testJson);

  serializer.deserializeMany(arr, 'App.Tag', testJson);
  arr.forEach(function(item) {
    equal(item.get('isLoaded'), true);
  });
});

test('deserializing resets state', function() {
  var data = {
    id: 1,
    featured: [ { id: 1, title: 'hello' } ]
  };

  var postGroup = App.PostGroup.load(data);

  // dirty a relationship
  postGroup.get('featured').objectAt(0).set('title', 'goodbye');
  ok( postGroup.get('featured.isDirty'), 'relationship was dirtied');
  ok( postGroup.get('isDirty'), 'parent was dirtied');

  postGroup.deserialize(data);
  ok( !postGroup.get('featured.isDirty'), 'relationship is clean after deserialize');
  ok( !postGroup.get('isDirty'), 'is clean after deserialize');
});

test('can optionally include belongsTo properties when serializing', function() {
  var model = App.Comment.load({ author: { name: 'Garth' } }),
      serialized = model.serialize({ includeRelationships: true });

  equal( serialized.comment.author.name, 'Garth', 'belongsTo property serialized' );
});
