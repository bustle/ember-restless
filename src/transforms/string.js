import Transform from './base';

var isNone = Ember.isNone;

export default Transform.extend({
  deserialize: function(serialized) {
    return isNone(serialized) ? null : String(serialized);
  },
  serialize: function(deserialized) {
    return isNone(deserialized) ? null : String(deserialized);
  }
});
