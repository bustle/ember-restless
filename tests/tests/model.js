var get = Ember.get, set = Ember.set;

module('Model');

test('no longer new once a primary key is assigned', function() {
  var post = App.Post.create();

  ok( post.get('isNew'), 'new models are new' );
  post.set('id', 1);
  ok( !post.get('isNew'), 'models with a primary key are not new' );
});


test('becomes dirty when changing a value', function() {
  var post = App.Post.create();

  ok( !post.get('isDirty'), 'new models are not dirty' );
  post.set('title', 'Hello ember!');
  ok( post.get('isDirty'), 'changed models are dirty' );
});


test('becomes dirty when a relationship becomes dirty', function() {
  var postGroup = App.PostGroup.load({
    id: 1,
    featured: [ { id: 1, title: 'hello' } ]
  });

  ok( !postGroup.get('isDirty'), 'freshly loaded model is not dirty' );

  postGroup.get('featured').objectAt(0).set('title', 'world');

  ok( postGroup.get('isDirty'), 'dirtying a relationship dirties the parent' );
});


test('attributes can have default values', function() {
  var model = RL.Model.extend({
    role: RL.attr('string', { defaultValue: 'user' }),
    position: RL.attr('number', { defaultValue: 1 }),
  });
  var record = model.create({ position: 2 });

  equal( record.get('role'), 'user', 'defaultValue was applied when no value' );
  equal( record.get('position'), 2, 'defaultValue was not set when value exists' );
});


test('attributes can have a default value functions', function() {
  var valueFunction = sinon.spy(function() { return new Date(); }),
      model = RL.Model.extend({ createdAt: RL.attr('date', { defaultValue: valueFunction }) }),
      record = model.create();

  var createdAt = record.get('createdAt');

  ok( createdAt, 'defaultValue function used when no value');
  equal( record.get('createdAt'), createdAt, "repeated calls return same value");
  ok( valueFunction.calledOnce, "function only called once");
});


test('attributes and relationships provided on create are not overwritten', function() {
  var post = App.Post.create({ title: 'A title' }),
      comment = App.Comment.create({ post: post, text: 'Some comment' });

  equal( comment.get('post'), post, 'relationship provided on init is same object' );
  equal( comment.get('post.title'), 'A title', 'related object not changed on init' );
});


test('loading raw representation', function() {
  var comment = App.Comment.load({
    id: 1,
    text: 'This looks awesome!',
    post: {
      id: 10,
      title: 'A new data library'
    },
    likes: [
      { id: 122, username: 'gdub22' },
      { id: 123, username: 'nixme'  }
    ]
  });

  equal( comment.get('id'), 1, 'loads model data' );
  equal( comment.get('post.id'), 10, 'belongsTo data' );
  equal( comment.get('likes.firstObject.id'), 122, 'hasMany data' );

  ok( comment.get('isLoaded'),       'model is loaded' );
  ok( !comment.get('isNew'),         'model is not new' );
  ok( comment.get('likes.isLoaded'), 'hasMany child is loaded' );
  ok( comment.get('post.isLoaded'),  'belongsTo is loaded' );
});
