var attributeDefaults = {
  readOnly: false,
  belongsTo: false,
  hasMany: false,
  isAttribute: false,
  isRelationship: false
};

function makeComputedAttribute(type, opts) {
  opts = $.extend({}, attributeDefaults, { type: type }, opts);

  return Ember.computed(function(key, value) {
    var data = this.get('_data');

    if (arguments.length === 1) {       // Getter
      value = data[key];

      if (value === undefined) {        // Default values
        if (typeof opts.defaultValue === 'function') {
          value = opts.defaultValue();
        } else {
          value = opts.defaultValue;
        }
        data[key] = value;
      }
    } else if (value !== data[key]) {   // Setter
      data[key] = value;
      if (!opts.readOnly) {
        this._onPropertyChange(key);
      }
    }

    return value;
  }).property('_data').meta(opts);
}

// Standard property
RESTless.attr = function(type, opts) {
  opts = $.extend({ isAttribute: true }, opts);
  return makeComputedAttribute(type, opts);
};

// belongsTo: One-to-one relationship between two models
RESTless.belongsTo = function(type, opts) {
  var defaultRecord = function() {
    return get(Ember.lookup, type).create();
  };
  opts = $.extend({ isRelationship: true, belongsTo: true, defaultValue: defaultRecord }, opts);
  return makeComputedAttribute(type, opts);
};

// hasMany: One-to-many & many-to-many relationships
RESTless.hasMany = function(type, opts) {
  var defaultArray = function() {
    return RESTless.RecordArray.createWithContent({type: type});
  };
  opts = $.extend({ isRelationship: true, hasMany: true, defaultValue: defaultArray }, opts);
  return makeComputedAttribute(type, opts);
};
