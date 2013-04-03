/*
 * RESTArray
 * Base class extention for RESTful arrays
 */
(function() {

'use strict';

RESTless.RESTArray = Em.ArrayProxy.extend( RESTless.State, {
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
      itemProto = Em.get(window, type) || Em.Object;
    }
    this.pushObject(itemProto.create(opts));
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
    var mergedOpts = $.extend({ content: Em.A() }, opts);
    return RESTless.RESTArray.create(mergedOpts);
  }
});

})();
