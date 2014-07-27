RESTless.StringTransform = RESTless.Transform.extend({
  deserialize: function(serialized) {
    return isNone(serialized) ? null : String(serialized);
  },
  serialize: function(deserialized) {
    return isNone(deserialized) ? null : String(deserialized);
  }
});
