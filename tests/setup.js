App = Ember.Application.create();

App.Post = RL.Model.extend({
  slug: RL.attr('string'),
  title: RL.attr('string'),
  body: RL.attr('string'),
  tags: RL.hasMany('App.Tag'),
  createdAt: RL.attr('date')
});

App.Tag = RL.Model.extend({
  name: RL.attr('string')
});

App.PostGroup = RL.Model.extend({
  featured: RL.hasMany('App.Post'),
  popular: RL.hasMany('App.Post', { readOnly: true })
});

App.Person = RL.Model.extend({
  slug: RL.attr('string'),
  name: RL.attr('string'),
  role: RL.attr('number')
});

App.Comment = RL.Model.extend({
  text: RL.attr('string'),
  post: RL.belongsTo('App.Post'),
  author: RL.belongsTo('App.Person'),
  likes: RL.hasMany('App.Like')
});

App.Like = RL.Model.extend({
  username: RL.attr('string')
});

App.ClientAddress = RL.Model.extend();

App.Person.FIXTURES = [
  { id: 1, name: 'Garth', role: 3 },
  { id: 2, name: 'Tyler', role: 3 },
  { id: 3, name: 'Beth', role: 1 }
];
