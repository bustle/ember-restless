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

var exports = Ember.lookup;

/*
  Define public modules
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

/*
  Expose for global namespace 
  and create shortcut alias `RL`
 */
exports.RL = exports.RESTless = RESTless;

/*
  Run RESTless initializer
 */
Ember.Application.initializer({
  name: 'RESTless.Client',
  initialize: function(container, application) {
    var client = application.Client ? application.Client : Client.create();
    RESTless.set('client', client);
    application.addObserver('Client', this, function() {
      RESTless.set('client', this.Client);
    });
    RESTless.__container__ = container;
  }
});

export default RESTless;
