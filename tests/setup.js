App = Ember.Application.create();

App.Post = RL.Model.extend({
  slug: RL.attr('number'),
  title: RL.attr('string'),
  body: RL.attr('string'),
  created: RL.attr('date')
});