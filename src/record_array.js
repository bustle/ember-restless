/*
 * RecordArray
 * Base class extention for arrays of Models
 */
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model class the array contains
   */
  type: null,

  getTypeClass: function() {
    var type = this.get('type');
    return type ? get(Ember.lookup, type) : null;
  },

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function() {
    var typeClass = this.getTypeClass() || Ember.Object,
        item = typeClass.create.apply(typeClass, arguments);
    return this.pushObject(item);
  },

  /*
   * adapter: Uses the adapter instance of the model type it contains
   */
  adapter: Ember.computed(function() {
    var typeClass = this.getTypeClass();
    if(typeClass) {
      return get(typeClass, 'adapter');
    }
    return get(RESTless, 'client.adapter');
  }).property('type', 'RESTless.client.adapter'),

  /* 
   * deserializeMany: use the current Serializer to populate the array from supplied data
   */
  deserializeMany: function(data) {
    return get(this, 'adapter.serializer').deserializeMany(this, this.get('type'), data);
  },
  /* 
   * serializeMany: use the current Serializer turn the array into data representation
   */
  serializeMany: function() {
    return get(this, 'adapter.serializer').serializeMany(this, this.get('type'));
  },

  /*
   * replaceContent: Changes array contents. Overriden to mark RecordArray as
   * dirty if loaded.
   */
  replaceContent: function(idx, amt, objects) {
    get(this, 'content').replace(idx, amt, objects);
    if (this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  },

  /*
   * _onItemDirtyChange: (private) observes when items become dirty
   */
  _onItemDirtyChange: Ember.observer(function() {
    var clean = this.get('content').everyProperty('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }, '@each.isDirty'),
  /*
   * _onLoadedChange: (private) observes when the array's isLoaded state changes
   * and updates each item's isLoaded to match
   */
  _onLoadedChange: Ember.observer(function() {
    if(this.get('isLoaded')) {
      this.forEach(function(item) {
        item.onLoaded();
      });
    }
  }, 'isLoaded')
});

/*
 * RecordArray (static)
 */
RESTless.RecordArray.reopenClass({
  /*
   * create: override state property defaults not implemented or applicable to arrays
   */
  create: function() {
    var arr = this._super.apply(this, arguments);
    return arr.setProperties({ _isReady: true, isNew: false });
  },
  /*
   * createWithContent: helper to create a RecordArray with the content property initialized
   */
  createWithContent: function() {
    var arr = this.create.apply(this, arguments);
    if(!arr.content) { arr.set('content', Ember.A()); }
    return arr;
  }
});
