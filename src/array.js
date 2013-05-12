/*
 * RecordArray
 * Base class extention for arrays of Models
 */
RESTless.RecordArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model class the array contains
   */
  type: null,

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function(opts) {
    var type = this.get('type'),
        itemClass = type ? get(window, type) : Ember.Object;
    this.pushObject(itemClass.create(opts));
  },

  /* 
   * deserializeMany: use the current Serializer to populate the array from supplied data
   */
  deserializeMany: function(data) {
    return RESTless.get('client.adapter.serializer').deserializeMany(this, this.get('type'), data);
  },
  /* 
   * serializeMany: use the current Serializer turn the array into data representation
   */
  serializeMany: function() {
    return RESTless.get('client.adapter.serializer').serializeMany(this, this.get('type'));
  },

  /*
   * _onContentChange: (private) observes when items in the array are changed.
   * Marks the RecordArray as dirty if loaded.
   */
  _onContentChange: function() {
    if(this.get('isLoaded')) {
      this.set('isDirty', true);
    }
  }.observes('@each'),
  /*
   * _onItemDirtyChange: (private) observes when items become dirty
   */
  _onItemDirtyChange: function() {
    var clean = this.get('content').everyProperty('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }.observes('@each.isDirty'),
  /*
   * _onLoadedChange: (private) observes when the array's isLoaded state changes
   * and updates each item's isLoaded to match
   */
  _onLoadedChange: function() {
    if(this.get('isLoaded')) {
      this.setEach('isLoaded', true);
    }
  }.observes('isLoaded')
});

/*
 * RecordArray (static)
 */
RESTless.RecordArray.reopenClass({
  /*
   * createWithContent: helper to create a RecordArray with the content property initialized
   */
  createWithContent: function(opts) {
    return RESTless.RecordArray.create($.extend({ content: Ember.A() }, opts));
  }
});
