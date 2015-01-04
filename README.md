# Ember RESTless [![Build Status](https://travis-ci.org/bustlelabs/ember-restless.png?branch=master)](https://travis-ci.org/bustlelabs/ember-restless)

RESTless is a lightweight data persistence library for [Ember.js](http://emberjs.com).

Out of the box, it is used to communicate with a remote JSON REST API to map data between a server and your Ember.js application.  

RESTless can be extended to support various other data persistence layers. For example, to handle XML data instead of JSON, or persist data to localStorage instead of a remote server.

One of its main goals is to reproduce much of the simple, useful features of [ember-data](https://github.com/emberjs/data), and reflect a similar API, while remaining lightweight and stable. RESTless does not contain all of the features provided by ember-data, but was created to be less complex and contain most of the functionality needed for basic CRUD apps.  Transitioning between the two should be possible with minimal effort.

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
    - [Side-loading records](#side-loading-records)
    - [Model lifecycle](#model-lifecycle)
- [Promises](#promises)
- [Advanced](#advanced)
- [Building](#building)
- [Tests](#tests)
- [Add-ons](#add-ons)

## Getting started

Include [ember-restless.js](https://raw.github.com/bustlelabs/ember-restless/master/dist/ember-restless.js) in your Ember application after ember.js

or via package managers:
```bower install ember-restless```  
```npm install ember-restless```

**Namespace**

RESTless can be referenced either with the namespace **RESTless** or the shorthand **RL**.  Similar to **Ember** and **Em**

### Defining a RESTAdapter

The REST adapter is responsible for communicating with your backend REST service.
Here, you can optionally set the host, and a namespace.  
For example, if your REST API is located at http://api.example.com/v1
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  host: 'http://api.example.com',
  namespace: 'v1'
});
```

### Defining a 'Client'

Similar to defining the 'Store' using ember-data, instead define the 'Client' for your application.  RESTless will automatically detect the Client on your application namespace and initialize RESTless to work with your app.

``` javascript
App.Client = RL.Client.create({
  adapter: App.RESTAdapter
});
```

### Models

Each model you create should extend RL.Model:  

``` javascript
App.Post = RL.Model.extend({
  title:       RL.attr('string'),
  isPublished: RL.attr('boolean'),
  readCount:   RL.attr('number'),
  createdAt:   RL.attr('date')
});
```
Supported attribute types are string, number, boolean, and date. Defining a type is optional.
You can define custom attribute type transforms in your adapter.  See the advanced section below.

**Note on ES6 modules**  
If using ES6 modules/ember-cli, you'll need to explicitly define `resourceName` on all of your model classes:

``` javascript
var Post = RL.Model.extend({ ... });

Post.reopenClass({
  resourceName: 'post'
});

export default Post;
```


### Relationships

For one-to-one relationships use the _belongsTo_ attribute helper.

``` javascript
App.User = RL.Model.extend({
  name: RL.attr('string'),
  role: RL.attr('number')
});

App.Profile = RL.Model.extend({
  user: RL.belongsTo('user')
});
```

For one-to-many relationships, use the _hasMany_ helper.  
For example, if a ```Post``` model contains an array of ```Tag``` models:
``` javascript
App.Tag = RL.Model.extend({
  name: RL.attr('string'),
  count: RL.attr('number')
});

App.Post = RL.Model.extend({
  tags: RL.hasMany('tag')
});
```
_Currently, all relational data should be embedded in the response. Also, see [Side-loading records](#side-loading-records)._


### Finding records

Use the ```find()``` method to retrieve records.

To find all records of type 'post':

``` javascript
var posts = App.Post.find();
// => Array of 'post' records
```

To find a 'post' with an primary key of `1`:

``` javascript
var post = App.Post.find(1);
// => 'post' record instance
```

To use a query to find records:
``` javascript
var posts = App.Post.find({ isPublished: true });
// => Array of 'post' records
```

To return a Promise when finding records, use `fetch()`. See the [promises](#promises) section.


### Creating records

Create records like you would a normal Ember Object:

``` javascript
var post = App.Post.create({
  title: 'My First Post'
});
```

### Saving records

Simply call: ```saveRecord()```  
The Adapter will automatically POST to save a new record, or PUT to update an existing record.

``` javascript
var post = App.Post.create({ title: 'My First Post' });
post.saveRecord();
```
Updating:
``` javascript
post.set('title', 'My Very First Post');
post.saveRecord();
```

### Deleting records

The Adapter will delete the record from the data store, then destroy the object when complete:
``` javascript
post.deleteRecord();
```

### Reloading records

To refresh an existing record from the data store: ```reloadRecord()```

``` javascript
var post = App.Post.find(1);
// ...
post.reloadRecord();
```

### Side-loading records

You can manually populate records using raw data (side-loading).  
Use the ```load``` and ```loadMany``` convenience methods:

``` javascript
var post = App.Post.create();

// The following could have been retrieved from a separate ajax request
var commentData = { comment: { id: 101, message: 'This is awesome!' } };
var comment = App.Comment.load(commentData);
post.set('comment', comment);

var postTagData = [
  { id: 1, name: 'technology', count: 50 },
  { id: 2, name: 'entertainment', count: 11 }
];
var tags = App.Tag.loadMany(postTagData);
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
``` javascript
var post = App.Post.create({ title: 'My First Post' });

post.on('didCreate', function() {
  console.log('post created!');
});
post.on('becameError', function(error) {
  console.log('error saving post!');
});
post.saveRecord();
```

``` javascript
var allPosts = App.Post.find();

allPosts.on('didLoad', function() {
  console.log('posts retrieved!');
});
allPosts.on('becameError', function(error) {
  console.log('error getting posts!');
});
```

### Promises

CRUD actions return promises (```saveRecord()```, ```deleteRecord()```, ```reloadRecord()```), allowing you to do the following:
``` javascript
var post = App.Post.create({
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
``` javascript
var posts = App.Post.fetch().then(function(records) {
  // Success!
}, function(error) {
  // Error!
});
```
Using the router:
``` javascript
App.PostIndexRoute = Ember.Route.extend({
  model: function() {
    App.Post.fetch();
  }
});
```


## Advanced

### Changing resource endpoints
Sometimes the name of your Ember model is different than the API endpoint.  
For example if a ```CurrentUser``` model needs to point to ```/users``` and ```/user/1```  
``` javascript
App.CurrentUser = RL.Model.extend();
App.CurrentUser.reopenClass({
  resourceName: 'user'
});
```

### Custom plurals configuration
You can use a custom adapter to set irregular plural resource names
``` javascript
App.RESTAdapter.configure('plurals', {
  person: 'people'
});
```

### Changing the the primary key for a model
The primary key for all models defaults to 'id'. 
You can customize it per model class to match your API:
``` javascript
App.RESTAdapter.map('post', {
  primaryKey: 'slug'
});
```

### Mapping different property keys
For example, if your JSON has a key ```lastNameOfPerson``` and the desired attribute name is ```lastName```:
``` javascript
App.Person = RL.Model.extend({
  lastName: RL.attr('string')
});
App.RESTAdapter.map('person', {
  lastName: { key: 'lastNameOfPerson' }
});
```

### Sending headers and/or data with every request (e.g. api keys)
To add a header to every ajax request:
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  headers: { 'X-API-KEY' : 'abc1234' }
});
```
To add data to every request url:
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  defaultData: { api_key: 'abc1234' }
});
```
Results in e.g. ```App.User.find()``` => ```http://api.example.com/users?api_key=abc1234```

### Forcing content type extensions
If you want the RESTAdapter to add extensions to requests:
For example ```/users.json``` and ```/user/1.json```  
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  useContentTypeExtension: true
});
```

### Default attribute values
You can define default values to assign to newly created instances of a model:
``` javascript
App.User = RL.Model.extend({
  name: RL.attr('string'),
  role: RL.attr('number', { defaultValue: 3 })
});
```

### Read-only attributes
You can make attributes 'read-only', which will exclude them from being serialized and transmitted when saving.
For example, if you want to let the backend compute the date a record is created:
``` javascript
App.Person = RL.Model.extend({
  firstName: RL.attr('string'),
  lastName: RL.attr('string'),
  createdAt: RL.attr('date', { readOnly: true })
});
```

### Read-only models
You can make an entire model to read-only. This removes all 'write' methods and provides a slight performance increase since each property won't have to be observed for 'isDirty'.
``` javascript
App.Post = RL.ReadOnlyModel.extend({
...
});
```

### Custom transforms
You can add custom transforms to modify data coming from and being sent to the persistence layer.
``` javascript
App.RESTAdapter.registerTransform('timeAgo', RL.Transform.create({
  deserialize: function(serialized) {
    // return a custom date string, such as: '5 minutes ago'
  }
}));
```
``` javascript
App.Comment = RL.Model.extend({
  createdAt: RL.attr('timeAgo')
});
```

### Custom Adapters & Serializers
RESTless is abstracted so you can write your own Adapters and Serializers.
``` javascript
App.XMLSerializer = RL.Serializer.create({
  ...
});
App.SOAPAdapter = RL.Adapter.create({
  serializer: App.XMLSerializer
  ...
});
App.Client = RL.Client.create({
  adapter: App.SOAPAdapter
});
```


## Building

If you wish to build ember-restless yourself, you will need node.js and Grunt.  

1. Install node: <a href='http://nodejs.org/'>http://nodejs.org/</a>
2. Install dependencies: ```npm install```
3. Build: ```grunt build```
4. Output will be in ```dist/```


## Testing

1. Install bower: ```npm install -g bower```
2. Install dependencies: ```bower install```
3. Test: ```grunt test``` or open tests/index.html in a browser  

#### ```grunt``` default task will both build & test.

## Add-ons

RESTless also has the following (unbundled) add-ons, which you can include separately or build yourself:
- Fixture Adapter
- LocalStorage Adapter

