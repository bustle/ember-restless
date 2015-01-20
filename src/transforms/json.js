import StringTransform from './string';
import NumberTransform from './number';
import BooleanTransform from './boolean';
import DateTransform from './date';

/**
  @property JSONTransforms
  @type Object
  @for RESTless
*/
export default {
  'string'  : StringTransform.create(),
  'number'  : NumberTransform.create(),
  'boolean' : BooleanTransform.create(),
  'date'    : DateTransform.create()
};
