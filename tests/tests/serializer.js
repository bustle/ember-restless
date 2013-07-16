var get = Ember.get, set = Ember.set;

module('Serializer');

test('a serialzer can be created', function() {
  var serialzer = RL.Serializer.create();
  ok( serialzer, 'an serialzer exists' );
});
