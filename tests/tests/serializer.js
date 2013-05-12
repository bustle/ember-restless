var get = Ember.get, set = Ember.set;

module('Serializer');

test('a serialzer can be created', function() {
  var serialzer = RL.Serializer.create();
  ok( serialzer, 'an serialzer exists' );
});

test('a custom serialzer throws error if required methods not implemented', function() {
  var serialzer = RL.Serializer.create();
  throws( function() { serialzer.deserialize() }, Ember.Error, 'required error thrown' );
  throws( function() { serialzer.deserializeProperty() }, Ember.Error, 'required error thrown' );
  throws( function() { serialzer.deserializeMany() }, Ember.Error, 'required error thrown' );
  throws( function() { serialzer.serialize() }, Ember.Error, 'required error thrown' );
  throws( function() { serialzer.serializeProperty() }, Ember.Error, 'required error thrown' );
  throws( function() { serialzer.serializeMany() }, Ember.Error, 'required error thrown' );
});
