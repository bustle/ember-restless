/*
 * RESTArray
 * Base class extention for RESTful arrays
 */

RESTless.RESTArray = Ember.ArrayProxy.extend( RESTless.State, {
  /*
   * type: type of model the array contains
   */
  type: null,

  /*
   * createItem: pushes an new object of type onto array
   */
  createItem:function(opts) {
    var type = this.get('type'), itemProto;
    if(type) {
      itemProto = get(window, type) || Ember.Object;
    }
    this.pushObject(itemProto.create(opts));
  },

  /* 
   * serializeMany: use the current Adapter turn the array into json representation
   */
  serializeMany: function() {
    return RESTless.get('client.adapter').serializeMany(this, this.get('type'));
  },

  /* 
   * deserializeMany: use the current Adapter to populate the array from supplied json
   */
  deserializeMany: function(json) {
    return RESTless.get('client.adapter').deserializeMany(this, this.get('type'), json);
  }
});

/*
 * RESTArray (static)
 */
RESTless.RESTArray.reopenClass({
  /*
   * createWithContent: helper to create a RESTArray with the content property initialized
   */
  createWithContent: function(opts) {
    var mergedOpts = $.extend({ content: Ember.A() }, opts);
    return RESTless.RESTArray.create(mergedOpts);
  }
});
