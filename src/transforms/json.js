/**
  @property JSONTransforms
  @type Object
  @for RESTless
*/
var JSONTransforms = RESTless.JSONTransforms = {
  'string'  : StringTransform.create(),
  'number'  : NumberTransform.create(),
  'boolean' : BooleanTransform.create(),
  'date'    : DateTransform.create()
};
