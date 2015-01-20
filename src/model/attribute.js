import RecordArray from './record-array';

var merge = Ember.merge;

/**
  Defines an attribute on a Model.
  Supports types: 'string', 'number', 'boolean', 'date'.

  @method attr
  @for RESTless
  @param {String} type the attribute type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
function attr(type, opts) {
  var meta = merge({ type: type, isAttribute: true }, opts);
  return makeComputedAttribute(meta);
}

/**
  Defines a one-to-one relationship attribute on a Model.

  @method belongsTo
  @for RESTless
  @param {String} type the belongsTo Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
function belongsTo(type, opts) {
  var meta = merge({ type: type, isRelationship: true, belongsTo: true }, opts);
  return makeComputedAttribute(meta);
}

/**
  Defines a one-to-many relationship attribute on a Model.

  @method hasMany
  @for RESTless
  @param {String} type the hasMany Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
function hasMany(type, opts) {
  var defaultArray = function() {
    return RecordArray.createWithContent();
  },
  meta = merge({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
  return makeComputedAttribute(meta);
}

function makeComputedAttribute(meta) {
  return Ember.computed(function(key, value) {
    var data = this.get('_data');
    // Getter
    if (arguments.length === 1) {
      value = data[key];

      if (value === undefined) { 
        // Default values
        if (typeof meta.defaultValue === 'function') {
          value = meta.defaultValue.call(this);
        } else {
          value = meta.defaultValue;
        }
        data[key] = value;
      }
    }
    // Setter 
    else if (value !== data[key]) {
      data[key] = value;
      if (!meta.readOnly) {
        this._onPropertyChange(key);
      }
    }
    return value;
  }).property('_data').meta(meta);
}

export { attr, belongsTo, hasMany };
