App = Ember.Application.create();

App.Post = RL.Model.extend({
  slug: RL.attr('number'),
  title: RL.attr('string'),
  body: RL.attr('string'),
  created: RL.attr('date')
});

App.PostGroup = RL.Model.extend({
  featured: RL.hasMany('App.Post'),
  popular: RL.hasMany('App.Post')
});

App.Person = RL.Model.extend({
  name: RL.attr('string'),
  role: RL.attr('number')
});