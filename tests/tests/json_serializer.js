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
