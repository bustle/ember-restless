var get = Ember.get, set = Ember.set;

module('FixtureAdapter');

module( 'FixtureAdapter', {
  setup: function() {
    App.set('Client', RL.Client.create({
      adapter: RL.FixtureAdapter.create()
    }));
  }
});

test('find fixture by primary key', function() {
  var person = App.Person.find(1);
  equal( person.get('name'), 'Garth', 'resource found' );
});

test('find fixtures by query', function() {
  var people = App.Person.find({ name: 'Garth' });
  ok( people.get('length') > 0, 'resource found' );
  equal( people.objectAt(0).get('name'), 'Garth', 'resource correct' );

  people = App.Person.find({ role: 3 });
  ok( people.get('length') === 2, 'resources found' );
});

test('findAll fixtures', function() {
  var people = App.Person.find();
  equal( people.get('length'), 3, 'resources found' );
});

test('can save a record', function() {
  var person = App.Person.create({ name: 'Mike' });
  person.saveRecord();
  equal( App.Person.FIXTURES.length, 4, 'record saved' );
});

asyncTest('can update a record', 2, function() {
  var person = App.Person.find(1);
  person.set('role', 99);
  person.saveRecord().then(function(record) {
    equal( record.get('role'), 99, 'record updated after promise' );
    equal( person.get('role'), 99, 'record updated after promise' );
    start();
  });
});

asyncTest('attemping to save an unmodified record resolves correctly', 1, function() {
  var person = App.Person.find(2);
  person.saveRecord().then(function(record) {
    equal( person, record, 'record returned unmodified' );
    start();
  });
});

asyncTest('can delete a record', 1, function() {
  var person = App.Person.find(2);
  person.deleteRecord().then(function(record) {
    equal( person, record, 'record deleted' );
    start();
  }, function() {
    start();
  });
});
