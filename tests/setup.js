App = Ember.Application.create();

App.Post = RL.Model.extend({
  slug: RL.attr('number'),
  title: RL.attr('string'),
  body: RL.attr('string'),
  tags: RL.hasMany('App.Tag'),
  created: RL.attr('date')
});

App.Tag = RL.Model.extend({
  name: RL.attr('string')
});

App.PostGroup = RL.Model.extend({
  featured: RL.hasMany('App.Post'),
  popular: RL.hasMany('App.Post')
});

App.Person = RL.Model.extend({
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
