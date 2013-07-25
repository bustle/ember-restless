/*
 * RecordArray
 * Base class extention for arrays of Models
 */
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * adapter: hook for overriding the record array adapter
   */
  adapter: Ember.computed(function() {
    return get(RESTless, 'client.adapter');
  }).property('RESTless.client.adapter'),

  /* 
   * deserializeMany: use the current Serializer turn the data into a record array
   */
  deserializeMany: function(type, data) {
    return get(this, 'adapter.serializer').deserializeMany(this, type, data);
  },
  /* 
   * serializeMany: use the current Serializer turn the array into data representation
   */
  serializeMany: function(type) {
    return get(this, 'adapter.serializer').serializeMany(this, type);
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
   * and triggers each items onLoaded
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
