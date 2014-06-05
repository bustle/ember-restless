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

test('serializeMany', function() {
  var data = [ { id: 1 }, { id: 2 } ];
  var recordArr = App.Tag.loadMany(data);
  var serialized = recordArr.serializeMany('App.Tag');
  deepEqual( data, serialized, 'RecordArray serialized. provided type' );

  recordArr = App.Tag.loadMany(data);
  serialized = recordArr.serializeMany();
  deepEqual( data, serialized, 'RecordArray serialized. auto type' );

  recordArr = RL.Model.loadMany(data);
  serialized = recordArr.serializeMany();
  deepEqual( data, serialized, 'RecordArray serialized. no type' );  

  data = [];
  recordArr = App.Tag.loadMany(data);
  serialized = recordArr.serializeMany();
  deepEqual( data, serialized, 'RecordArray serialized. no data' );
});

test('deserializeMany', function() {
  function commontTest(msg) {
    equal( recordArr.get('length'), 2, 'correct length: ' + msg);
    equal( recordArr.objectAt(0).constructor, App.Tag, 'correct type: ' + msg);
    equal( recordArr.objectAt(0).get('name'), 'tag1', 'correct content: ' + msg);
  }

  var data = [ { name: 'tag1' }, { name: 'tag2' } ];
  var recordArr = RL.RecordArray.createWithContent();
  recordArr.deserializeMany('App.Tag', data);
  commontTest('createWithContent');

  recordArr = RL.RecordArray.create();
  recordArr.deserializeMany('App.Tag', data);
  commontTest('create');
});
