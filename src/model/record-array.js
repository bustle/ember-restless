import RESTless from '../core';
import ModelStateMixin from './state';
import Model from './model';

var get = Ember.get;

/**
  RecordArray is an Array of Model objects.

  @class RecordArray
  @namespace RESTless
  @extends Ember.ArrayProxy
*/
var RecordArray = Ember.ArrayProxy.extend( ModelStateMixin, {
  /**
    The default adapter for the RecordArray. Providing a hook for overriding.
    @property adapter
   */
  adapter: Ember.computed('RESTless.client.adapter', function() {
    return get(RESTless, 'client.adapter');
  }),

  /**
    Use the current Serializer to turn the data into a record array.
    @method deserializeMany
    @param {Object} type The type of model class
    @param {Object} data The data to deserialize
    @returns RESTless.RecordArray
   */
  deserializeMany: function(type, data) {
    type = type || this.typeOfContent();
    if(!this.content) { 
      this.set('content', Ember.A());
    }
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
    Observes when items become dirty and sets itself to dirty.
    @private
   */
  _onItemDirtyChange: Ember.observer('@each.isDirty', function() {
    var clean = this.get('content').isEvery('isDirty', false);
    if(this.get('isLoaded') && !clean) {
      this.set('isDirty', true);
    }
  }),

  /**
    Observes when the array's isLoaded state changes and triggers each item's onLoaded.
    @private
   */
  _onLoadedChange: Ember.observer('isLoaded', function() {
    if(this.get('isLoaded')) {
      this.forEach(function(item) {
        if(Model.detectInstance(item)) {
          item.onLoaded();
        }
      });
    }
  })
});


RecordArray.reopenClass({
  /**
    Creates a RecordArray
    @method create
    @returns RESTless.RecordArray
   */
  create: function(options) {
    // If no content was provided, default to an empty array.
    options = options || {};
    if (!options.content) {
      options.content = Ember.A();
    }

    // Properly apply rest args to super's create()
    var restArgs = Array.prototype.slice.call(arguments, 1);
    var args = [options].concat(restArgs);

    var arr = this._super.apply(this, args);

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
    return this.create.apply(this, arguments);
  }
});

export default RecordArray;
