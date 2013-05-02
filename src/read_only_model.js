/*
 * ReadOnlyModel
 * Subclass for models that are read-only.
 * Removes property change observers and write methods.
 * Helps improve performance when write functionality is not needed.
 */
(function() {

'use strict';

RESTless.ReadOnlyModel = RESTless.Model.extend({

  /* 
   * init: for read-only models, we don't need to _addPropertyObservers 
   */
  init: function() {
    this._initProperties();
  },

  /*
   * Remove functionality associated with writing data
   */
  serialize: null,

  saveRecord: null,

  deleteRecord: null

});

})();
