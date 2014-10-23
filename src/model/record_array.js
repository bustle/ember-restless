/**
  RecordArray is an Array of Model objects.

  @class RecordArray
  @namespace RESTless
  @extends Ember.ArrayProxy
  @uses RESTless.State
*/
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /**
    The default adapter for the RecordArray. Providing a hook for overriding.
    @property adapter
   */
  adapter: computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /**
    Use the current Serializer to turn the data into a record array.
    @method deserializeMany
    @param {Object} type The type of model class
    @param {Object} data The data to deserialize
    @returns RESTless.RecordArray
   */
  deserializeMany: function(type, data) {
    this._initContent();
    type = type || this.typeOfContent();
    return get(this, 'adapter.serializer').deserializeMany(this, type, data);
  },

  /**
    Use the current Serializer to turn the array into its data representation.
    @method serializeMany
    @param {Object} type The type of model class
    @returns RESTless.RecordArray
   */
  serializeMany: function(type) {
    type = type || this.typeOfContent();
    return get(this, 'adapter.serializer').serializeMany(this, type);
  },

  /**
    Overrides super replaceContent method to add isDirty functionality
    @method replaceContent
    @param {Number} idx The starting index
    @param {Number} amt The number of items to remove from the content.
    @param {Array} objects Optional array of objects to insert or null if no objects.
   */
  replaceContent: function(idx, amt, objects) {
    get(this, 'content').replace(idx, amt, objects);
    if (this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  },

  /**
    Returns the Class of records the RecordArray contains
    @method typeOfContent
    @returns Object type
   */
  typeOfContent: function() {
    var firstObj = this.objectAt(0);
    return firstObj && firstObj.constructor || null;
  },

  /**
    Helper to initialize the content property of the RecordArray if not present.
    @private
    @method _initContent
    @returns RecordArray this
   */
  _initContent: function() {
    if(!this.content) { 
      this.set('content', Ember.A());
    }
    return this;
  },

  /**
    Observes when items become dirty and sets itself to dirty.
    @private
   */
  _onItemDirtyChange: Ember.observer(function() {
    var clean = this.get('content').everyBy('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }, '@each.isDirty'),

  /**
    Observes when the array's isLoaded state changes and triggers each item's onLoaded.
    @private
   */
  _onLoadedChange: Ember.observer(function() {
    if(this.get('isLoaded')) {
      this.forEach(function(item) {
        if(RESTless.Model.detectInstance(item)) {
          item.onLoaded();
        }
      });
    }
  }, 'isLoaded')
});


RESTless.RecordArray.reopenClass({
  /**
    Creates a RecordArray
    @method create
    @returns RESTless.RecordArray
   */
  create: function() {
    var arr = this._super.apply(this, arguments);
    // override State defaults not implemented or applicable to arrays
    arr.setProperties({ _isReady: true, isNew: false });
    return arr;
  },
  /**
    Helper to create a RecordArray with it's content property initialized to an Array
    @method createWithContent
    @returns RESTless.RecordArray
   */
  createWithContent: function() {
    var arr = this.create.apply(this, arguments);
    return arr._initContent();
  }
});
