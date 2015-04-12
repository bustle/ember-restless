module.exports = {
  name: 'ember-restless',

  init: function(name) {
    this.treePaths['vendor'] = 'dist';
  },

  included: function(app) {
    this._super.included(app);
    app.import('vendor/ember-restless.js');
  }
};