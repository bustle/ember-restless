/*
 * State
 * Mixin for managing model lifecycle state
 */
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /* 
   * isLoaded: model has retrived
   */
  isLoaded: false,
  /* 
   * isDirty: model has changes that have not yet been saved
   */
  isDirty: false,
  /* 
   * isSaving: model is in the process of saving
   */
  isSaving: false,
  /* 
   * isError: model has been marked as invalid after response from adapter
   */
  isError: false,
  /* 
   * errors: error message json returned from REST service
   */
  errors: null,

  /* 
   * clearErrors: (helper) reset isError flag, clear error messages
   */
  clearErrors: function() {
    this.setProperties({ 'isError': false, 'errors': null });
    return this;
  },

  /* 
   * copyState: copies the current state to a cloned object
   */
  copyState: function(clone) {
    return clone.setProperties({
      isLoaded: this.get('isLoaded'),
      isDirty:  this.get('isDirty'),
      isSaving: this.get('isSaving'),
      isError:  this.get('isError'),
      errors:   this.get('errors')
    });
  },

  /* 
   * _triggerEvent: (private) helper method to trigger lifecycle events
   */
  _triggerEvent: function(name, data) {
    Ember.run(this, function() {
      this.trigger(name, data);
    });
  },

  /* 
   * _onError: (private) helper method for handling error responses
   * Parses error json, sets error properties, and triggers error events
   * TODO: Move to REST/JSON only implementation
   */
  _onError: function(errorResponse) {
    var errorJson;
    try { errorJson = $.parseJSON(errorResponse); } catch(e){}
    this.setProperties({ 'isError': true, 'errors': errorJson });
    this._triggerEvent('becameError', this.get('errors'));
  }
});
