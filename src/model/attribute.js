import RecordArray from './record-array';

var merge = Ember.merge;
var computed = Ember.computed;
var supportsNewComputedSyntax = true;
try {
  computed({ set: function(){}, get: function(){} });
} catch(e) {
  supportsNewComputedSyntax = false;
}

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

function computedAttributeGet(key, meta) {
  var data = this.get('_data');
  var value = data[key];

  if (value === undefined) { 
    if (typeof meta.defaultValue === 'function') {
      value = meta.defaultValue.call(this);
    } else {
      value = meta.defaultValue;
    }
    data[key] = value;
  }
  return value;
}

function computedAttributeSet(key, value, meta) {
  var data = this.get('_data');
  if (value !== data[key]) {
    data[key] = value;
    if (!meta.readOnly) {
      this._onPropertyChange(key);
    }
  }
  return value;
}

function makeComputedAttribute(meta) {
  var computedAttribute;
  if (supportsNewComputedSyntax) {
    computedAttribute = {
      get: function(key) {
        return computedAttributeGet.call(this, key, meta);
      },
      set: function(key, value) {
        return computedAttributeSet.call(this, key, value, meta);
      }
    };
  } else {
    computedAttribute = function(key, value) {
      if (arguments.length === 1) {
        return computedAttributeGet.call(this, key, meta);
      }
      return computedAttributeSet.call(this, key, value, meta);
    };
  }

  return computed('_data', computedAttribute).meta(meta);
}

export { attr, belongsTo, hasMany };
