# Ember RESTless [![Build Status](https://travis-ci.org/endlessinc/ember-restless.png?branch=master)](https://travis-ci.org/endlessinc/ember-restless)

RESTless is a lightweight data persistence library for Ember.js. (~3KB minified & gzipped)

It is used to communicate with a remote JSON API to map data between a backend and your Ember.js application.
Eventually, the library can be extended to support various other data persistence layers.

One of its main goals is to reproduce much of the simple, useful features of [ember-data](https://github.com/emberjs/data), and reflect a similar API, while remaining lightweight and stable.

Ember-data is a great project and we look forward to it being production ready.  RESTless does not contain all of the features provided by ember-data, but was created to be less complex and contain most of the functionality needed for basic CRUD apps.  Transitioning between the two should be possible with minimal effort.  The main departure from ember-data is the idea of the 'Store'. Instead, all transactions are executed immediately.

## Getting started

Include ```ember-restless.js``` from the dist/ folder in your application.

### Namespace

RESTless can be referenced either with the namespace **RESTless** or the shorthand **RL**.  Similar to **Ember** and **Em**

### Defining a 'Client'

Similar to defining the 'Store' using ember-data, instead define the REST 'Client' for your application.  RESTless will automatically detect the RESTClient on your application namespace.  Defining a client is currently optional, and only needed if you would like to provide a custom adapter.

``` javascript
App.RESTClient = RL.RESTClient.create({
  revision: 1,
  adapter: App.RESTAdapter
});
```

### Defining a custom Adapter

Create a custom adapter to set a url to your backend REST service and optionally the namespace.
For example, if your REST API is located at http://api.myservice.com/v1
``` javascript
App.RESTAdapter = RL.RESTAdapter.create({
  url: 'http://api.myservice.com',
  namespace: 'v1'
});
```
See the **Advanced** section below for further use of a custom adapter.

### Defining Models

Each model you create should extend RL.Model
``` javascript
App.User = RL.Model.extend();
```

### Attributes

Supported types are string, number, boolean, and date.  With a custom adapter, you can register custom types and transformations.
``` javascript
App.User = RL.Model.extend({
  name: RL.attr('string'),
  isActive: RL.attr('boolean'),
  followerCount: RL.attr('number'),
  createdAt: RL.attr('date')
});
```

### Relationships

For one-to-one properties use the _belongsTo_ attribute helper.

``` javascript
App.User = RL.Model.extend({
  profile: RL.belongsTo('App.Profile')
});
App.Profile = RL.Model.extend({
  user: RL.belongsTo('App.User')
});
```

One-to-many and many-to-many, use the _hasMany_ helper.
For example, if a ```Post``` model contains an array of ```Tag``` models:
``` javascript
App.Post = RL.Model.extend({
  tags: RL.hasMany('App.Tag')
});
App.Tag = RL.Model.extend({
  name: RL.attr('string'),
  count: RL.attr('number')
});
```

Currently, all relational data should be present in the expected json response. 'Sideloading' this data may be added in a future release.
For example, all of the 'tags' data should be available in the initial response:
``` json
{
  post: {
    id: 1,
    tags: [
      {
        id: 1,
        name: 'tag1',
        count: 50
      },
      {
        id: 2,
        name: 'tag2',
        count: 11
      }
    ]
  }
}
```

### Finding records

To find a Post with an id of 1:

``` javascript
var post = App.Post.find(1);
```

To use a query to find:
``` javascript
var people = App.Person.find({ name: "Peter" });
```

### Find all

Use findAll(), or alternatively use find() and omit parameters

``` javascript
var posts = App.Post.findAll();
```
or
``` javascript
var posts = App.Post.find();
```

### Creating records

Create records like you would a normal Ember Object

``` javascript
var post = App.Post.create({
  title: 'My First Post',
  body: 'Lorem ipsum...'
});
```
### Saving records

To save a record to the REST service call: saveRecord()
RESTless will automatically POST to save a new record, or PUT to update and existing record

``` javascript
var post = App.Post.create();
post.saveRecord();
```
Updating:
``` javascript
post.set('title', 'My Very First Post');
post.saveRecord();
```

### Deleting records

Will tell the REST service to delete the record, then destroy the object
``` javascript
post.deleteRecord();
```

### Model lifecycle

RESTless supports most of the lifecycle states and events of ember-data.
All model objects have the following properties added:

* **isLoaded**: Record(s) have been retrieved from REST service
* **isDirty**: The record has local changes that have not yet been saved remotely
* **isSaving**: Record is in the process of saving to the backend
* **isNew**: Record has been created but not yet saved remotely
* **isError**: Record has been attempted to be saved, updated, or deleted but the backend returned an error

Additionally, you can subscribe to events that are fired during the lifecycle

* **didLoad**
* **didCreate**
* **didUpdate**
* **becameError**

Event Examples:
``` javascript
var post = App.Post.create({
  title: 'My First Post',
  body: 'Lorem ipsum...'
});

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

## Advanced

### Custom plurals configuration
You can use a custom adapter to set irregular plural resource names
``` javascript
App.RESTAdapter.configure("plurals", {
  person: "people"
});
```

### Changing the the primary key for a model
The primary key for all models defaults to 'id'. 
You can customize it per model class to match your backend:
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


### Read-only attributes
Make attributes 'read-only', which will exclude them from being serialized into the json sent to your service when saving.
For example, if you want to let the backend compute the date a record is created:
``` javascript
App.Person = RL.Model.extend({
  firstName: RL.attr('string'),
  lastName: RL.attr('string'),
  createdAt: RL.attr('date', { readOnly: true })
});
```

### Read-only models
If you want the entire model to be read-only and also remove all 'write' methods.
Also provides a performance increase since each property won't have to be observed for 'isDirty'.
``` javascript
App.Post = RL.ReadOnlyModel.extend({
...
});
```

### Custom transforms
You can use a custom adapter to add custom transforms:
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

## Building RESTless

If you wish to build ember-restless youself, you will need node.js and Grunt.  

1. Install node: <a href="http://nodejs.org/">http://nodejs.org/</a>
2. Open a terminal window
3. Install dependencies: ```npm install```
4. Build: ```grunt```
5. Output will be *dist/ember-restless.js* and *dist/ember-restless.min.js*


## Tests

Uses QUnit.
To run tests, open tests/index.html in a browser.  
Tests are currently a work in progress.

## Example App

Coming soon.
