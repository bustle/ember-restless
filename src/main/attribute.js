/**
  Defines an attribute on a Model.
  Supports types: 'string', 'number', 'boolean', 'date'.

  @method attr
  @for RESTless
  @param {String} type the attribute type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.attr = function(type, opts) {
  var meta = merge({ type: type, isAttribute: true }, opts);
  return makeComputedAttribute(meta);
};

/**
  Defines a one-to-one relationship attribute on a Model.

  @method belongsTo
  @for RESTless
  @param {String} type the belongsTo Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.belongsTo = function(type, opts) {
  var meta = merge({ type: type, isRelationship: true, belongsTo: true }, opts);
  return makeComputedAttribute(meta);
};

/**
  Defines a one-to-many relationship attribute on a Model.

  @method hasMany
  @for RESTless
  @param {String} type the hasMany Class type
  @param {Object} [opts] a hash of options
  @return {Ember.computed} attribute
*/
RESTless.hasMany = function(type, opts) {
  var defaultArray = function() {
    return RESTless.RecordArray.createWithContent();
  },
  meta = merge({ type: type, isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
  return makeComputedAttribute(meta);
};

function makeComputedAttribute(meta) {
  return computed(function(key, value) {
    var data = this.get('_data');
    // Getter
    if (arguments.length === 1) {
      value = data[key];

      if (value === undefined) { 
        // Default values
        if (typeof meta.defaultValue === 'function') {
          value = meta.defaultValue();
        } else {
          value = meta.defaultValue;
        }
        data[key] = value;
      }
    }
    // Setter 
    else if (value !== data[key]) {
      data[key] = value;
      if (!meta.readOnly && !RESTless.ReadOnlyModel.detectInstance(this)) {
        this._onPropertyChange(key);
      }
    }
    return value;
  }).property('_data').meta(meta);
}
