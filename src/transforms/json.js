/**
  @property JSONTransforms
  @type Object
  @for RESTless
*/
RESTless.JSONTransforms = {
  'string'  : RESTless.StringTransform.create(),
  'number'  : RESTless.NumberTransform.create(),
  'boolean' : RESTless.BooleanTransform.create(),
  'date'    : RESTless.DateTransform.create()
};
