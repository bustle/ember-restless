/**
  A read-only model. Removes property change observers and write methods.
  Helps improve performance when write functionality is not needed.

  @class ReadOnlyModel
  @namespace RESTless
  @extends RESTless.Model
*/
RESTless.ReadOnlyModel = RESTless.Model.extend({
  serialize: null,
  saveRecord: null,
  deleteRecord: null,
  didDefineProperty: null,
  _onPropertyChange: noop
});
