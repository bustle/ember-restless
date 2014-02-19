var get = Ember.get, set = Ember.set;

module('LSAdapter');

module( 'LSAdapter', {
  setup: function() {
    App.set('Client', RL.Client.create({
      adapter: RL.LSAdapter.create()
    }));
  }
});

asyncTest('Deleting previous entries', 1, function() {
  App.Person.setCircularLimit(-1);
  App.Person.deleteAll();

  var people = App.Person.find();
  equal( people.get('length'), 0, 'All clear');
  start();
});

test('Inserting initial data', function() {
  var p1 = App.Person.create({ id: 1, name: 'Garth', role: 3 });
  var p2 = App.Person.create({ id: 2, name: 'Tyler', role: 3 });
  var p3 = App.Person.create({ id: 3, name: 'Beth', role: 1 });
  p1.saveRecord();
  p2.saveRecord();
  p3.saveRecord();

  var people = App.Person.find();
  equal( people.get('length'), 3, 'Added resources' );
});


test('find entry by primary key', function() {
  var person = App.Person.find(1);
  equal( person.get('name'), 'Garth', 'resource found' );
});

test('find entries by query', function() {
  var people = App.Person.find({ name: 'Garth' });
  ok( people.get('length') > 0, 'resource found' );
  equal( people.objectAt(0).get('name'), 'Garth', 'resource correct' );

  people = App.Person.find({ role: 3 });
  ok( people.get('length') === 2, 'resources found' );
});

test('findAll entries', function() {
  var people = App.Person.find();
  equal( people.get('length'), 3, 'resources found' );
});

test('can save a record', function() {
  var person = App.Person.create({ name: 'Mike' });
  person.saveRecord();
  var people = App.Person.find();
  equal( people.get('length'), 4, 'record saved' );
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

test('Testing circular limit', function() {
  var people = App.Person.find();
  equal( people.get('length'), 3, 'resources found' );

  App.Person.setCircularLimit(2);
  people = App.Person.find();
  equal( people.get('length'), 2, 'Dumped overflowing data' );
});

test('can save a record with circular limit', function() {
  var person = App.Person.create({ name: 'Mark' });
  person.saveRecord();

  var people = App.Person.find();
  equal( people.get('length'), 2, 'record saved' );

  person = App.Person.find(4);
  equal( person.get('name'), 'Mike', 'record found' );
  
  person = App.Person.find(5);
  equal( person.get('name'), 'Mark', 'record found' );
});

test('Unlimited storage', function() {
  var people = App.Person.find();
  equal( people.get('length'), 2, 'resources found' );
  
  App.Person.setCircularLimit(-1);
  
  var person = App.Person.create({ name: 'Karl' });
  person.saveRecord();
  
  people = App.Person.find();
  equal( people.get('length'), 3, 'Limit extended' );
});

