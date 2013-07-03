/*
 * State
 * Mixin for managing model lifecycle state
 */
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /* 
   * isLoaded: model has been retrieved
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
   * errors: error data returned from adapter
   */
  errors: null,

  /*
   * Internal state change handlers, called by adapter
   */
  onSaved: function(wasNew) {
    this.setProperties({
      isDirty: false,
      isSaving: false,
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent(wasNew ? 'didCreate' : 'didUpdate');
    this._triggerEvent('didLoad');
  },

  onDeleted: function() {
    this._triggerEvent('didDelete');
    Ember.run.next(this, function() {
      this.destroy();
    });
  },

  onLoaded: function() {
    this.setProperties({
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent('didLoad');
  },

  onError: function(errors) {
    this.setProperties({
      isSaving: false,
      isError: true,
      errors: errors
    });
    this._triggerEvent('becameError');
  },

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
  _triggerEvent: function(name) {
    Ember.run(this, function() {
      this.trigger(name, this);
    });
  }
});
