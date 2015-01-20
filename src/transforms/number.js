import Transform from './base';

var isEmpty = Ember.isEmpty;

export default Transform.extend({
  deserialize: function(serialized) {
    return isEmpty(serialized) ? null : Number(serialized);
  },
  serialize: function(deserialized) {
    return isEmpty(deserialized) ? null : Number(deserialized);
  }
});
