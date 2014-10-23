/**
  The State Mixin is responsible for keeping state and
  handling state events for Models.

  @class State
  @namespace RESTless
  @uses Ember.Evented
*/
RESTless.State = Ember.Mixin.create( Ember.Evented, {
  /**
    Model has not yet been saved; not yet assigned a primary key.
    @property isNew
    @type {Boolean}
  */
  isNew: true,
  /**
    Model has been retrieved and properties set.
    @property isLoaded
    @type {Boolean}
  */
  isLoaded: false,
  /**
    Model has changes that have not yet been saved.
    @property isDirty
    @type {Boolean}
  */
  isDirty: false,
  /**
    Model model is in the process of saving.
    @property isSaving
    @type {Boolean}
  */
  isSaving: false,
  /**
    Model model is in error state.
    @property isError
    @type {Boolean}
  */
  isError: false,

  /**
    Hash of current errors on model.
    @property errors
    @type Object
  */
  errors: null,

  /**
    Fired when the record is created.
    @event didCreate
  */
  didCreate: noop,
  /**
    Fired when the record is updated.
    @event didUpdate
  */
  didUpdate: noop,
  /**
    Fired when the record is enters the loaded state.
    @event didLoad
  */
  didLoad: noop,
  /**
    Fired when the record is deleted.
    @event didDelete
  */
  didDelete: noop,
  /**
    Fired when the record enters the error state.
    @event becameError
  */
  becameError: noop,

  /**
    Updates state and triggers events upon saving.
    @method onSaved
    @param {Boolean} wasNew was a new model prior to saving.
   */
  onSaved: function(wasNew) {
    this.setProperties({
      isDirty: false,
      isSaving: false,
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent(wasNew ? 'didCreate' : 'didUpdate', this);
    this._triggerEvent('didLoad', this);
  },

  /**
    Updates state and triggers events upon deletion.
    @method onDeleted
   */
  onDeleted: function() {
    this._triggerEvent('didDelete', this);
    Ember.run.next(this, function() {
      this.destroy();
    });
  },

  /**
    Updates state and triggers events upon loading.
    @method onLoaded
   */
  onLoaded: function() {
    this.setProperties({
      isDirty: false,
      isSaving: false,
      isLoaded: true,
      isError: false,
      errors: null
    });
    this._triggerEvent('didLoad', this);
  },

  /**
    Updates state and triggers events upon an error.
    @method onError
   */
  onError: function(errors) {
    this.setProperties({
      isSaving: false,
      isError: true,
      errors: errors
    });
    this._triggerEvent('becameError', errors);
  },

  /**
    Clears errors and resets error state
    @method clearErrors
    @returns {Object}
   */
  clearErrors: function() {
    this.setProperties({ isError: false, errors: null });
    return this;
  },

  /**
    Copies the current state to a cloned object
    @method copyState
    @param {Object} clone the cloned object
    @returns {Object} the cloned object with copied state
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
  },

  /**
    Flag for deferring dirty state when setting initial values on create() or load()
    @property _isReady
    @type {Boolean}
    @private
  */
  _isReady: false,

  /**
    Helper function to trigger events on models and to any listeners.
    @method _triggerEvent
    @private
  */
  _triggerEvent: function(event, data) {
    Ember.run(this, function() {
      Ember.tryInvoke(this, event, [data]);
      this.trigger(event, data);
    });
  }
});
