module.exports = {
  name: 'ember-restless',

  init: function(name) {
    this._super.apply(this, arguments);
    this.treePaths['vendor'] = 'dist';
  },

  included: function(app) {
    this._super.included(app);

    var options = {
      exports: {
        'ember-restless': [ 'default' ]
      }
    };

    app.import('vendor/ember-restless.js', options);
  }
};
