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
   * resourceTypeNamePlural: helper to get the plural resource name for array object type
   */
  resourceTypeNamePlural: function() {
    var typeInstance = get(window, this.get('type')).create();
    return get(typeInstance.constructor, 'resourceNamePlural');
  }.property('type'),

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
  }
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
