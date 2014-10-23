var get = Ember.get, set = Ember.set;

module('Serializer');

test('a serialzer can be created', function() {
  var serialzer = RL.Serializer.create();
  ok( serialzer, 'an serialzer exists' );
});

test('modelFor resolves various string and class references', function() {
  var serialzer = RL.Serializer.create();

  var PersonModel = App.Person;
  equal( serialzer.modelFor('App.Person'), PersonModel, 'looks up global strings');
  equal( serialzer.modelFor(App.Person), PersonModel, 'direct references pass through');
  equal( serialzer.modelFor('person'), PersonModel, 'looks up container strings');

  var PostGroupModel = App.PostGroup;
  equal( serialzer.modelFor('post-group'), PostGroupModel, 'container looks up dashed names');
  equal( serialzer.modelFor('postGroup'), PostGroupModel, 'container looks up camelized names');
});
