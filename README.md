# Ember RESTless [![Build Status](https://travis-ci.org/endlessinc/ember-restless.png?branch=master)](https://travis-ci.org/endlessinc/ember-restless)

RESTless is a lightweight data persistence library for Ember.js. (~4KB minified & gzipped)

Out of the box, it is used to communicate with a remote JSON REST API to map data between a server and your Ember.js application.  

RESTless can be extended to support various other data persistence layers. For example, to handle XML data instead of JSON, or store data to localStorage instead of a remote server.

One of its main goals is to reproduce much of the simple, useful features of [ember-data](https://github.com/emberjs/data), and reflect a similar API, while remaining lightweight and stable. RESTless does not contain all of the features provided by ember-data, but was created to be less complex and contain most of the functionality needed for basic CRUD apps.  Transitioning between the two should be possible with minimal effort.

## [API Documentation](http://endlessinc.github.io/ember-restless/api/)
Current version: **0.4.2**  
See the [Changelog](CHANGELOG.md) for the latest features and API changes.


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
- [Extras](#extras)
- [Advanced](#advanced)
- [Building RESTless](#building-restless)
- [Tests](#tests)

## Getting started

Include [ember-restless.js](https://raw.github.com/endlessinc/ember-restless/master/dist/ember-restless.js) in your application. (found in the ```dist/``` folder)

**Namespace**

RESTless can be referenced either with the namespace **RESTless** or the shorthand **RL**.  Similar to **Ember** and **Em**

### Defining a RESTAdapter

The REST adapter is responsible for communicating with your backend REST service.
Here, you can set the url, and optionally a namespace.  
For example, if your REST API is located at http://api.myservice.com/v1
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  url: 'http://api.myservice.com',
  namespace: 'v1'
});
```

### Defining a 'Client'

Similar to defining the 'Store' using ember-data, instead define the 'Client' for your application.  RESTless will automatically detect the Client on your application namespace and initialize RESTless to work with you app.

``` javascript
App.Client = RL.Client.create({
  adapter: App.RESTAdapter
});
```

### Models

Each model you create should extend RL.Model  
Supported attribute types are string, number, boolean, and date.

``` javascript
App.Post = RL.Model.extend({
  title:       RL.attr('string'),
  isPublished: RL.attr('boolean'),
  readCount:   RL.attr('number'),
  createdAt:   RL.attr('date')
});
```
You can define custom attribute types in your adapter.  See the advanced section below.


### Relationships

For one-to-one relationships use the _belongsTo_ attribute helper.

``` javascript
App.User = RL.Model.extend({
  name: RL.attr('string'),
  role: RL.attr('number')
});

App.Profile = RL.Model.extend({
  user: RL.belongsTo('App.User')
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
  tags: RL.hasMany('App.Tag')
});
```
_Currently, all relational data should be embedded in the response. Also, see [Side-loading records](#side-loading-records)._


### Finding records

Use the ```find()``` method to retrieve records.

To find a Post with an id of 1:

``` javascript
var post = App.Post.find(1);
```

To use a query to find:
``` javascript
var posts = App.Post.find({ isPublished: true });
```

To find all records:

``` javascript
var posts = App.Post.find();
```

```find()``` automatically handles all query types, however, explicit methods are also available:  
```findAll()```, ```findQuery()```, ```findByKey()``` / ```findById()```


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

The Adapter will delete the record remotely, then destroy the object when complete:
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

- - -  

## Extras

To keep RESTless lightweight and focused, the default distrubtion solely supports a REST Adapter.  
We are separately offering an "extras" build: [ember-restless+extras.js](https://raw.github.com/endlessinc/ember-restless/master/dist/ember-restless+extras.js).
Currently, this adds a FixtureAdapter, with more to come!

- - -  

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
App.RESTAdapter.configure("plurals", {
  person: "people"
});
```

### Changing the the primary key for a model
The primary key for all models defaults to 'id'. 
You can customize it per model class to match your API:
``` javascript
App.RESTAdapter.map("App.Post", {
  primaryKey: "slug"
});
```

### Mapping different property keys
For example, if your JSON has a key ```lastNameOfPerson``` and the desired attribute name is ```lastName```:
``` javascript
App.Person = RL.Model.extend({
  lastName: RL.attr('string')
});
App.RESTAdapter.map('App.Person', {
  lastName: { key: 'lastNameOfPerson' }
});
```

### Forcing content type extentions
If you want the RESTAdapter to add extentions to requests:
For example ```/users.json``` and ```/user/1.json```  
``` javascript
App.RESTAdapter = RESTless.RESTAdapter.create({
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
You can add custom transforms to your adapter:
``` javascript
App.RESTAdapter.registerTransform('timeAgo', {
  deserialize: function(serialized) {
    // return a custom date string, such as: '5 minutes ago'
  },
  serialize: function(deserialized) {
    // return a custom date json format for your backend or 
    // simply return deserialized
  }
});
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


## Building RESTless

If you wish to build ember-restless yourself, you will need node.js and Grunt.  

1. Install node: <a href="http://nodejs.org/">http://nodejs.org/</a>
2. Open a terminal window
3. Install dependencies: ```npm install```
4. To build and run tests: ```grunt```
5. Output will be in ```dist/```

### Custom Builds

You can create custom builds, that exclude optional packages and further reduce filesize.  
For example, to exclude the json transforms and date parsing libs:
```
grunt custom:-transforms
```

## Tests

Uses <a href="http://qunitjs.com/">QUnit</a>  
Tests are run during the grunt build process or running ```grunt test```  
To run tests in browsers, you can simply open tests/index.html in a browser.  


## Contributors

Thanks to the Ember core team and contributors for creating Ember and Ember Data.  
Special thanks to the following for creating & contributing to the ember-restless project:

- [Garth Poitras](https://github.com/gdub22) | [twitter](https://twitter.com/papapoitch)
- [Tyler Love](https://github.com/tylr)
- [Gopal Patel](https://github.com/nixme)
