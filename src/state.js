/*
 * State
 * Mixin for managing model lifecycle state
 */
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /*
   * isNew: model has not yet been saved.
   */
  isNew: true,
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
   * _isReady (private)
   * Flag for deferring dirty state when setting initial values on create() or load()
   */
  _isReady: false,
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
    Ember.run(this, function() {
      this.trigger(wasNew ? 'didCreate' : 'didUpdate', this);
      this.trigger('didLoad', this);
    });
  },

  onDeleted: function() {
    Ember.run(this, function() {
      this.trigger('didDelete', this);
    });
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
    Ember.run(this, function() {
      this.trigger('didLoad', this);
    });
  },

  onError: function(errors) {
    this.setProperties({
      isSaving: false,
      isError: true,
      errors: errors
    });
    Ember.run(this, function() {
      this.trigger('becameError', errors);
    });
  },

  /* 
   * clearErrors: (helper) reset isError flag, clear error messages
   */
  clearErrors: function() {
    this.setProperties({ isError: false, errors: null });
    return this;
  },

  /* 
   * copyState: copies the current state to a cloned object
   */
  copyState: function(clone) {
    var mi = RESTless.State.mixins,
        props = mi[mi.length-1].properties;
    Ember.beginPropertyChanges(clone);
    for(var p in props) { 
      if(props.hasOwnProperty(p) && typeof props[p] !== 'function') {
        clone.set(p, this.get(p));
      }
    }
    Ember.endPropertyChanges(clone);
    return clone;
  }

});
