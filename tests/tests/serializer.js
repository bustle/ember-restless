var get = Ember.get, set = Ember.set;

module('Serializer');

test('a serialzer can be created', function() {
  var serialzer = RL.Serializer.create();
  ok( serialzer, 'an serialzer exists' );
});

test('modelFor resolves string and class references', function() {
  var serialzer = RL.Serializer.create();
  equal( serialzer.modelFor('App.Person'), serialzer.modelFor(App.Person), 'model for type looks up strings or references');
});