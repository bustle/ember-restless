var NumberTransform = RESTless.NumberTransform = Transform.extend({
  deserialize: function(serialized) {
    return isEmpty(serialized) ? null : Number(serialized);
  },
  serialize: function(deserialized) {
    return isEmpty(deserialized) ? null : Number(deserialized);
  }
});
