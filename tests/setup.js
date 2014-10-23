App = Ember.Application.create();

App.Post = RL.Model.extend({
  slug: RL.attr('string'),
  title: RL.attr('string'),
  body: RL.attr('string'),
  tags: RL.hasMany('tag'),
  createdAt: RL.attr('date')
});

App.Tag = RL.Model.extend({
  name: RL.attr('string')
});

App.PostGroup = RL.Model.extend({
  featured: RL.hasMany('post'),
  popular: RL.hasMany('post', { readOnly: true })
});

App.Person = RL.Model.extend({
  slug: RL.attr('string'),
  name: RL.attr('string'),
  role: RL.attr('number')
});

App.Comment = RL.Model.extend({
  text: RL.attr('string'),
  post: RL.belongsTo('post'),
  author: RL.belongsTo('person'),
  likes: RL.hasMany('like')
});

App.Like = RL.Model.extend({
  username: RL.attr('string')
});

App.ClientAddress = RL.Model.extend();

App.Product = RL.Model.extend({
  name: RL.attr(),
  rating: RL.attr(),
  available: RL.attr(),
  createdAt: RL.attr(),
  seller: RL.belongsTo(App.Person)
});

App.Person.FIXTURES = [
  { id: 1, name: 'Garth', role: 3 },
  { id: 2, name: 'Tyler', role: 3 },
  { id: 3, name: 'Beth', role: 1 }
];
