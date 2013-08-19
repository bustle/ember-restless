var get = Ember.get, set = Ember.set;

module('Model');

test('no longer new once a primary key is assigned', function() {
  var post = App.Post.create();

  ok( post.get('isNew'), 'new models are new' );
  post.set('id', 1);
  ok( !post.get('isNew'), 'models with a primary key are not new' );
});

test('not new when creating with a primary id', function() {
  var post = App.Post.create({
    id: 1
  });
  ok( !post.get('isNew'), 'models with a primary key are not new' );

  var post2 = App.Post.load({
    id: 1
  });
  ok( !post2.get('isNew'), 'models with a primary key are not new' );
});

test('new models are not dirty', function() {
  var post = App.Post.create();
  ok( !post.get('isDirty'), 'new models are not dirty' );

  var post2 = App.Post.create({ title: 'Title' });
  ok( !post2.get('isDirty'), 'new models with properties are not dirty' );
});

test('becomes dirty when changing a value', function() {
  var post = App.Post.create();

  ok( !post.get('isDirty'), 'new models are not dirty' );
  post.set('title', 'Hello ember!');
  ok( post.get('isDirty'), 'changed models are dirty' );
});

test('use load to set data doesn\'t make it dirty', function() {
  var post = App.Post.load({
    title: 'Title'
  });
  ok( !post.get('isDirty'), 'model is not dirty' );
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

test('becomes dirty when a nested relationship becomes dirty', function() {
  var postGroup = App.PostGroup.load({
    id: 2,
    featured: [ { id: 1, title: 'hello', tags: [ { name: 'tag1' }, { name: 'tag2' } ] } ]
  });

  ok( !postGroup.get('isDirty'), 'freshly loaded model is not dirty' );

  postGroup.get('featured').objectAt(0).get('tags').objectAt(0).set('name', 'tagA');

  ok( postGroup.get('isDirty'), 'dirtying a nested relationship dirties the root object' );
});

test('does not become dirty when a readOnly nested relationship becomes dirty', function() {
  var postGroup = App.PostGroup.load({
    id: 3,
    popular: [ { id: 2, title: 'world', tags: [ { name: 'tag1' }, { name: 'tag2' } ] } ]
  });

  ok( !postGroup.get('isDirty'), 'freshly loaded model is not dirty' );

  postGroup.get('popular.firstObject').get('tags.firstObject').set('name', 'tagB');

  ok( !postGroup.get('isDirty'), 'dirtying a readOnly nested relationship did not dirty parent' );
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


test('can set a different adapter per model', function() {
  equal( get(App.Comment, 'adapter'), get(RESTless, 'client.adapter'), 'defaults to client adapter' );

  var testAdapter = RL.RESTAdapter.create({
    someProp: 'hi'
  });

  App.Comment.reopenClass({
    adapter: Ember.computed(function() {
      return testAdapter;
    }).property()
  });

  equal( get(App.Comment, 'adapter'), testAdapter, 'adapter for model class changed' );
});


asyncTest('event hooks', 1, function() {
  App.Comment.reopen({
    becameError: function (error) {
      this.set('test', 99);
    }
  });

  var comment = App.Comment.find(1);
  comment.get('currentRequest').abort().always(function() {
    equal( comment.get('test'), 99, 'event hook was invoked' );
    start();
  });
});
