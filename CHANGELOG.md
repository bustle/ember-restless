# Changelog

The change log documents features and breaking changes for each version.  
While RESTless reaches a 1.0 release and more feedback and testing continues, the API is subject to change.  
To keep the library small, API depreciation warnings may not be added.

### 0.6.2

- Gulp for task runner instead of Grunt
- `host` property in RESTAdapter now respects protocol-less assignments
- Update date serialization to toISOString
- Removing old, long deprecated properties/methods
- Using Pretender in tests for XHRs

### 0.6.1

- Bug fix to support Ember 1.8.0 which changed method signiture of Ember.Map.forEach
- Now using bower to install testing libs instead of packaging with project

### 0.6.0

- Support usage with ES6 modules / ember-cli
- Deprecated namespaces in relationship attrs & configurations. Should now reference models e.g. `'post'` instead of `'App.Post'`
- No longer distributing 'extras' builds, but still able to build it yourself.

### 0.5.4, 0.5.5

- Bug fixes

### 0.5.3

- Abstracted transforms & changed API for registering transforms (backwards compatible)
- Renamed `Client` initializer.
- Code cleanups

### 0.5.2

- Bug fixes

### 0.5.1

- Attribute types are now optional
- Relationship attributes can now be defined with object references as well as strings

### 0.5.0

- Deprecate `url` for `host` in RESTAdapter (matches ember-data)
- Added `headers` and `defaultData` properties to RESTAdapter
- Added LocalStorage Adapter in *extras*

### 0.4.2

- YUIDoc documentation 
- Bug fixes 

### 0.4.1

- Register via `Ember.libraries` 
- Using `Ember.exports` instead of `window` to expose library 
- Bower support 
- Bug fixes 

### 0.4.0

- FixtureAdapter
- Expose serializeProperty/deserializeProperty to Model 

### 0.3.2

- reloadRecord should modify original record
- Add state event hooks for models

### 0.3.1

- RecordArray no longer requires strict model type
- Add ability to set adapter for each model

### 0.3.0

- Added ```fetch()``` to find records returning Promises
- Added ```reloadRecord()``` method
- Added more robust error messages from remote requests
- Cleaned up State mixin

### 0.2.5

- Added ```useContentTypeExtension``` option to RESTAdapter

### 0.2.4

- Support for custom Grunt builds
- Use RSVP promises instead of jQuery's promise implementation
- Remove depreciation warnings, revision tracking

### 0.2.3

- Add option to force content type extention on requests

### 0.2.2

- Refactored attributes as computed properties with metadata
- let findByKey method support adding extra params
- Update 'find' method names

### 0.2.1

- Add external date parsing lib
- Add load and loadMany methods on Model
- Multi-word model support

### 0.2.0

- Refactored to abstract Adapter and Serializer
- **BREAKING**: Renamed classes, to support further abstraction:
    - RESTClient --> **Client**  
    - RESTArray --> **RecordArray**   

### 0.1.3

- Add map method to adapter for configurable properties and primary key
- Add ReadOnlyModel

### 0.1.2

- Add testing framework and basic tests
- Updated json transforms package

### 0.1.1

- Add readonly properties
- All attribute types support options

### 0.1.0

- Initial release  
