var get = Ember.get, set = Ember.set;

module('RecordArray');

test('new record arrays are not dirty', function() {
  var arr = RESTless.RecordArray.create();
  ok( !arr.get('isDirty'), 'new record arrays are not dirty' );

  var arr2 = RESTless.RecordArray.createWithContent();
  ok( !arr2.get('isDirty'), 'new record arrays created with content are not dirty' );

  var arr3 = RESTless.RecordArray.createWithContent([1, 2, 3]);
  ok( !arr3.get('isDirty'), 'new record arrays created with content are not dirty' );

  var arr4 = App.Tag.loadMany([ { name: 'tag1' }, { name: 'tag2' } ]);
  ok( !arr4.get('isDirty'), 'new record arrays created with loadMany are not dirty' );
});

test('loadMany', function() {
  var arr = App.Tag.loadMany([ { name: 'tag1' }, { name: 'tag2' } ]);
  equal( arr.get('length'), 2, 'loadMany models' );
});
