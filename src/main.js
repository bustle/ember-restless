import RESTless from './core';
import Client from './client';
import Adapter from './adapters/adapter';
import RESTAdapter from './adapters/rest-adapter';
import { attr, belongsTo, hasMany } from './model/attribute';
import Model from './model/model';
import ReadOnlyModel from './model/read-only-model';
import RecordArray from './model/record-array';
import Serializer from './serializers/serializer';
import JSONSerializer from './serializers/json-serializer';
import Transform from './transforms/base';
import BooleanTransform from './transforms/boolean';
import NumberTransform from './transforms/number';
import StringTransform from './transforms/string';
import DateTransform from './transforms/date';
import JSONTransforms from './transforms/json';
import './ext/date';

/*
  Export public modules to namespace
*/
RESTless.Client = Client;
RESTless.Adapter = Adapter;
RESTless.RESTAdapter = RESTAdapter;
RESTless.attr = attr;
RESTless.belongsTo = belongsTo;
RESTless.hasMany = hasMany;
RESTless.Model = Model;
RESTless.ReadOnlyModel = ReadOnlyModel;
RESTless.RecordArray = RecordArray;
RESTless.Serializer = Serializer;
RESTless.JSONSerializer = JSONSerializer;
RESTless.Transform = Transform;
RESTless.BooleanTransform = BooleanTransform;
RESTless.NumberTransform = NumberTransform;
RESTless.StringTransform = StringTransform;
RESTless.DateTransform = DateTransform;
RESTless.JSONTransforms = JSONTransforms;

export default RESTless;
