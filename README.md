# Ember RESTless [![Build Status](https://travis-ci.org/endlessinc/ember-restless.png?branch=master)](https://travis-ci.org/endlessinc/ember-restless)

RESTless is a lightweight data persistence library for Ember.js. (~3KB minified & gzipped)

Out of the box, it is used to communicate with a remote JSON REST API to map data between a server and your Ember.js application.  

RESTless can be extended to support various other data persistence layers. For example, to handle XML data instead of JSON, or store data to localStorage instead of a remote server.

One of its main goals is to reproduce much of the simple, useful features of [ember-data](https://github.com/emberjs/data), and reflect a similar API, while remaining lightweight and stable. RESTless does not contain all of the features provided by ember-data, but was created to be less complex and contain most of the functionality needed for basic CRUD apps.  Transitioning between the two should be possible with minimal effort.

### Current revision: 2
See [BREAKING_CHANGES](BREAKING_CHANGES.md) for the latest API changes.

## Getting started

Include ```ember-restless.js``` from the dist/ folder in your application.

### Namespace

RESTless can be referenced either with the namespace **RESTless** or the shorthand **RL**.  Similar to **Ember** and **Em**

### Defining a custom RESTAdapter

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

Similar to defining the 'Store' using ember-data, instead define the 'Client' for your application.  RESTless will automatically detect the Client on your application namespace.

``` javascript
App.Client = RL.Client.create({
  adapter: App.RESTAdapter
});
```

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
App.Tag = RL.Model.extend({
  name: RL.attr('string'),
  count: RL.attr('number')
});

App.Post = RL.Model.extend({
  tags: RL.hasMany('App.Tag')
});
```

Currently, all relational data should be embedded in the json response. 'Side-loading' this data may be added in a future release.
For example, all of the 'tags' data should be available in the response from ```App.Post.find(1)```
``` json
{
  "post": {
    "id": 1,
    "tags": [
      {
        "id": 1,
        "name": "tag1",
        "count": 50
      },
      {
        "id": 2,
        "name": "tag2",
        "count": 11
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

Use find() without parameters, or alternatively, findAll()  

``` javascript
var posts = App.Post.find();
```
or
``` javascript
var posts = App.Post.findAll();
```

### Creating records

Create records like you would a normal Ember Object.

``` javascript
var post = App.Post.create({
  title: 'My First Post',
  body: 'Lorem ipsum...'
});
```

### Saving records

To save a record call: saveRecord()  
The RESTAdapter will automatically POST to save a new record, or PUT to update and existing record.

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

The RESTAdapter Will delete the record remotely, then destroy the object when complete:
``` javascript
post.deleteRecord();
```

### 'Loading' Records

You can manually populate records using raw data. For example, if you have to side-load data, you can use the ```load``` and ```loadMany``` convenience methods:
``` javascript
var comment = App.Comment.load(jsonData);
var tags = App.Tag.loadMany(jsonData);
```

### Model lifecycle

RESTless supports most of the lifecycle states and events of ember-data.
All model objects have the following properties added:

* **isLoaded**: Record(s) have been retrieved
* **isDirty**: The record has local changes that have not yet been stored
* **isSaving**: Record is in the process of saving
* **isNew**: Record has been created but not yet saved
* **isError**: Record has been attempted to be saved, updated, or deleted but returned an error

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
You can use a custom rest adapter to set irregular plural resource names
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

### Default attribute values
You can define default values to assign to newly created instances of a model:
``` javascript
App.User = RL.Model.extend({
  name: RL.attr('string'),
  role: RL.attr('number', { defaultValue: 3 })
});
```

### Read-only attributes
Make attributes 'read-only', which will exclude them from being serialized and transmitted when saving.
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
You can use a custom rest adapter to add custom transforms:
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
4. Build: ```grunt```
5. Output will be *dist/ember-restless.js* and *dist/ember-restless.min.js*


## Tests

Uses QUnit.  
Tests are run during the grunt build process.  
To run tests manually, you can open tests/index.html in a browser.  
Tests are currently a work in progress.

## Example App

Coming soon.


## Contributors

Thanks to the Ember core team and contributors for creating Ember and Ember Data.  
Special thanks to the following for creating & contributing to the ember-restless project:

- [Garth Poitras](https://github.com/gdub22) | [twitter](https://twitter.com/papapoitch)
- [Tyler Love](https://github.com/tylr)
- [Gopal Patel](https://github.com/nixme)
