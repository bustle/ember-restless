# Ember RESTless [![Build Status](https://travis-ci.org/bustlelabs/ember-restless.png?branch=master)](https://travis-ci.org/bustlelabs/ember-restless)

RESTless is a lightweight data model library for [Ember.js](http://emberjs.com).

Out of the box, you can quickly and easily map data between a JSON REST API and your Ember.js application.  It's goal is to create a simple API to perform CRUD operations without having to write ajax requests or handle model serialization & deserialization.  RESTless is *not* a client-side data store.

See the full [API documentation](http://bustlelabs.github.io/ember-restless/api/).  

See the [change log](CHANGELOG.md) for the latest features and API changes.


## Guide
- [Getting started](#getting-started)
- [Defining a RESTAdapter](#defining-a-restadapter)
- [Defining a 'Client'](#defining-a-client)
- [Models](#models)
    - [Relationships](#relationships)
    - [Finding records](#finding-records)
    - [Creating records](#creating-records)
    - [Saving records](#saving-records)
    - [Deleting records](#deleting-records)
    - [Reloading records](#reloading-records)
    - [Loading records](#loading-records)
    - [Model lifecycle](#model-lifecycle)
- [Promises](#promises)
- [Advanced](#advanced)
- [Building](#building)
- [Tests](#tests)

## Getting started

**Install:**
 
```npm install --save-dev ember-restless```

**Module usage:**

```js
import RL from 'ember-restless'; // imports entire library
import { Model, attr } from 'ember-restless'; // or import individual modules
```

**Initializer:**  
Create an initializer in your ember-cli app:
`app/initializers/restless.js`:

```js
import Ember from 'ember';
import { Client } from 'ember-restless';

export function initialize() {
  var application = arguments[1] || arguments[0];
  application.set('Client', Client.create());
}

export default {
  initialize,
  name: 'restless',
  before: 'RESTless.Client'
};
```

### Defining a RESTAdapter

The REST adapter is responsible for communicating with your backend REST service.
Here, you can optionally set the host, and a namespace.  
For example, if your REST API is located at http://api.example.com/v1
```js
import { RESTAdapter } from 'ember-restless';

var adapter = RESTAdapter.create({
  host: 'http://api.example.com',
  namespace: 'v1'
});
```
You should then set your custom adapter as a property of the `Client`, created above.
```js
application.set('Client', Client.create({
  adapter: adapter
}));
```

### Models

Each model you create should extend Model:  

```js
import { Model, attr } from 'ember-restless';

var Post = Model.extend({
  title:       attr('string'),
  isPublished: attr('boolean'),
  readCount:   attr('number'),
  createdAt:   attr('date')
});

Post.reopenClass({
  resourceName: 'post'
});

export default Post;
```
Supported attribute types are string, number, boolean, and date. Defining a type is optional.
You can define custom attribute type transforms in your adapter.  See the advanced section below.

### Relationships

For one-to-one relationships use the _belongsTo_ attribute helper.

```js
var User = Model.extend({
  name: attr('string'),
  role: attr('number')
});

User.reopenClass({
  resourceName: 'user'
});

var Profile = Model.extend({
  user: belongsTo('user')
});
```

For one-to-many relationships, use the _hasMany_ helper.  
For example, if a ```Post``` model contains an array of ```Tag``` models:
```js
var Tag = Model.extend({
  name: attr('string'),
  count: attr('number')
});

var Post = Model.extend({
  tags: hasMany('tag')
});
```
_Currently, all relational data should be embedded in the response. Also, see [Loading records](#loading-records)._


### Finding records

Use the ```find()``` method to retrieve records.

To find all records of type 'post':

```js
var posts = Post.find();
// => Array of 'post' records
```

To find a 'post' with an primary key of `1`:

```js
var post = Post.find(1);
// => 'post' record instance
```

To use a query to find records:
```js
var posts = Post.find({ isPublished: true });
// => Array of 'post' records
```

To return a Promise when finding records, use `fetch()`. See the [promises](#promises) section.


### Creating records

Create records like you would a normal Ember Object:

```js
var post = Post.create({
  title: 'My First Post'
});
```

### Saving records

Simply call: ```saveRecord()```  
The Adapter will automatically POST to save a new record, or PUT to update an existing record.

```js
var post = Post.create({ title: 'My First Post' });
post.saveRecord();
```
Updating:
```js
post.set('title', 'My Very First Post');
post.saveRecord();
```

### Deleting records

The Adapter will delete the record from the data store, then destroy the object when complete:
```js
post.deleteRecord();
```

### Reloading records

To refresh an existing record from the data store: ```reloadRecord()```

```js
var post = Post.find(1);
// ...
post.reloadRecord();
```

### Loading records

You can manually populate records using raw data.  
Use the ```load``` and ```loadMany``` convenience methods:

```js
var post = Post.create();

// The following could have been retrieved from a separate ajax request
var commentData = { comment: { id: 101, message: 'This is awesome!' } };
var comment = Comment.load(commentData);
post.set('comment', comment);

var postTagData = [
  { id: 1, name: 'technology', count: 50 },
  { id: 2, name: 'entertainment', count: 11 }
];
var tags = Tag.loadMany(postTagData);
post.set('tags', tags);
```

### Model lifecycle and state

All models have the following state properties added:

* **isNew**: Record has been created but not yet saved
* **isLoaded**: Record(s) have been retrieved
* **isDirty**: The record has local changes that have not yet been stored
* **isSaving**: Record is in the process of saving
* **isError**: Record has been attempted to be saved, updated, or deleted but returned an error. Error messages are store in the **errors** property.

You can subscribe to events that are fired during the lifecycle:

* **didLoad**
* **didCreate**
* **didUpdate**
* **becameError**

**Event Examples:**
```js
var post = Post.create({ title: 'My First Post' });

post.on('didCreate', function() {
  console.log('post created!');
});
post.on('becameError', function(error) {
  console.log('error saving post!');
});
post.saveRecord();
```

```js
var allPosts = Post.find();

allPosts.on('didLoad', function() {
  console.log('posts retrieved!');
});
allPosts.on('becameError', function(error) {
  console.log('error getting posts!');
});
```

### Promises

CRUD actions return promises (```saveRecord()```, ```deleteRecord()```, ```reloadRecord()```), allowing you to do the following:
```js
var post = Post.create({
  title: 'My First Post'
});

post.saveRecord().then(function(record) {
  // Success!
}, function(errors) {
  // Error!
});
```

**To take advantage of promises when finding records, use ```fetch()``` instead of ```find()```**  
```fetch()``` returns a promise, while ```find()``` will return entities that will update when resolved.  
```js
var posts = Post.fetch().then(function(records) {
  // Success!
}, function(error) {
  // Error!
});
```
Using the router:
```js
export default Ember.Route.extend({
  model: function() {
    Post.fetch();
  }
});
```


## Advanced

### Changing resource endpoints
Sometimes the name of your Ember model is different than the API endpoint.  
For example if a ```CurrentUser``` model needs to point to ```/users``` and ```/user/1```  
```js
var CurrentUser = Model.extend();
CurrentUser.reopenClass({
  resourceName: 'user'
});
```

### Custom plurals configuration
You can use a custom adapter to set irregular plural resource names
```js
adapter.configure('plurals', {
  person: 'people'
});
```

### Changing the the primary key for a model
The primary key for all models defaults to 'id'. 
You can customize it per model class to match your API:
```js
adapter.map('post', {
  primaryKey: 'slug'
});
```

### Mapping different property keys
For example, if your JSON has a key ```lastNameOfPerson``` and the desired attribute name is ```lastName```:
```js
var Person = Model.extend({
  lastName: attr('string')
});
apdater.map('person', {
  lastName: { key: 'lastNameOfPerson' }
});
```

### Sending headers and/or data with every request (e.g. api keys)
To add a header to every ajax request:
```js
var adapter = RESTAdapter.create({
  headers: { 'X-API-KEY' : 'abc1234' }
});
```
To add data to every request url:
```js
var adapter = RESTAdapter.create({
  defaultData: { api_key: 'abc1234' }
});
```
Results in e.g. ```User.find()``` => ```http://api.example.com/users?api_key=abc1234```

### Forcing content type extensions
If you want the RESTAdapter to add extensions to requests:
For example ```/users.json``` and ```/user/1.json```  
```js
var adapter = RESTAdapter.create({
  useContentTypeExtension: true
});
```

### Default attribute values
You can define default values to assign to newly created instances of a model:
```js
var User = Model.extend({
  name: attr('string'),
  role: attr('number', { defaultValue: 3 })
});
```

### Read-only attributes
You can make attributes 'read-only', which will exclude them from being serialized and transmitted when saving.
For example, if you want to let the backend compute the date a record is created:
```js
var Person = Model.extend({
  firstName: attr('string'),
  lastName: attr('string'),
  createdAt: attr('date', { readOnly: true })
});
```

### Read-only models
You can make an entire model to read-only. This removes all 'write' methods and provides a slight performance increase since each property won't have to be observed for 'isDirty'.
```js
import { ReadOnlyModel } from 'ember-restless';
var Post = ReadOnlyModel.extend({
...
});
```

### Custom transforms
You can add custom transforms to modify data coming from and being sent to the persistence layer.
```js
import { Transform } from 'ember-restless';
adapter.registerTransform('timeAgo', Transform.create({
  deserialize: function(serialized) {
    // return a custom date string, such as: '5 minutes ago'
  }
}));
```
```js
var Comment = Model.extend({
  createdAt: attr('timeAgo')
});
```

## Building
```shell
npm run build
```

## Testing
Install test dependencies: ```bower install```
```shell
npm test
```
or open tests/index.html in a browser  
