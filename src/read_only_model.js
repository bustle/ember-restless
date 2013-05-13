/*
 * ReadOnlyModel
 * Subclass for models that are read-only.
 * Removes property change observers and write methods.
 * Helps improve performance when write functionality is not needed.
 */
RESTless.ReadOnlyModel = RESTless.Model.extend({
  /*
   * Remove functionality associated with writing data
   */
  serialize: null,
  saveRecord: null,
  deleteRecord: null,
  didDefineProperty: null
});
