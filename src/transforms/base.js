/**
  Base class for transforming data to/from persistence layer in the Adapter.
  Subclasses should implement `serialize` & `deserialize` methods.
  These are copied closely from ember-data:
  `https://github.com/emberjs/data/tree/master/packages/ember-data/lib/transforms`

  @class Transform
  @namespace RESTless
  @extends Ember.Object
 */
export default Ember.Object.extend({
  /**
    Transforms serialized data (i.e. JSON) to deserialized data (i.e. Ember models).
    Subclasses should implement.

    @method deserialize
    @param serialized serialized data
    @return deserialize data
  */
  deserialize: function(serialized) {
    return serialized;
  },
  
  /**
    Transforms deserialized data (i.e. Ember models) to serialized data (i.e. JSON).

    @method serialize
    @param deserialized deserialized data
    @return serialized data
  */
  serialize: function(deserialized) {
    return deserialized;
  }
});
