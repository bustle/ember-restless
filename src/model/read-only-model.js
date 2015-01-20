import Model from './model';

/**
  A read-only model. Removes property change observers and write methods.
  Helps improve performance when write functionality is not needed.

  @class ReadOnlyModel
  @namespace RESTless
  @extends RESTless.Model
*/
var ReadOnlyModel = Model.extend({
  serialize: null,
  saveRecord: null,
  deleteRecord: null,
  didDefineProperty: null,
  _onPropertyChange: Ember.K
});

export default ReadOnlyModel;