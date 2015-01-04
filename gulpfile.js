var del     = require('del');
var gulp    = require('gulp');
var jshint  = require('gulp-jshint');
var qunit   = require('gulp-qunit');
var concat  = require('gulp-concat');
var replace = require('gulp-replace');
var header  = require('gulp-header');
var footer  = require('gulp-footer');
var util    = require('gulp-util');
var open    = require('gulp-open');
var pkg     = require('./package.json');

// ------------------------------------------- 

var coreSrc = [
  'src/index.js',
  'src/model/attribute.js',
  'src/transforms/base.js',
  'src/transforms/string.js',
  'src/transforms/number.js',
  'src/transforms/boolean.js',
  'src/transforms/date.js',
  'src/transforms/json.js',
  'src/serializers/serializer.js',
  'src/serializers/json_serializer.js',
  'src/adapters/adapter.js',
  'src/adapters/rest_adapter.js',
  'src/client.js',
  'src/model/state.js',
  'src/model/model.js',
  'src/model/read_only_model.js',
  'src/model/record_array.js',
  'src/ext/date.js'
];

var addonsSrc = [
  'src/addons/fixture_adapter.js',
  'src/addons/ls_adapter.js'
];

var allScr = coreSrc.concat(addonsSrc);

var distDest = './dist/';
var jsDistName = 'ember-restless.js';
var jsDistAddonsName = 'ember-restless+addons.js';
var jsDistPath = distDest + jsDistName;
var jsDistAddonsPath = distDest + jsDistAddonsName;

var testRunnerCore = './tests/index.html';
var testRunnerAddons = './tests/addons.html';
var testScripts = './tests/tests/*.js';

var banner = ['/**',
              ' * <%= pkg.name %>',
              ' * @overview <%= pkg.description %>',
              ' * @version  <%= pkg.version %>',
              ' * @author   <%= pkg.author %>',
              ' * @license  <%= pkg.license %>',
              ' * Copyright (c) 2013-2015 Bustle Labs',
              ' * Last modified: ' + util.date('mmm d, yyyy'),
              ' */',
              ''].join('\n');

var iifeHeader = '\n(function(Ember, undefined) {\n\n\'use strict\';\n\n';
var iifeFooter = '\n})(Ember);\n';

function performBuild(files, outputFile) {
  return gulp.src(files)
             .pipe(concat(outputFile))
             .pipe(replace(/@@version/g, pkg.version))
             .pipe(header(iifeHeader))
             .pipe(footer(iifeFooter))
             .pipe(header(banner, { pkg : pkg } ))
             .pipe(gulp.dest(distDest));
}

gulp.task('lint', function() {
  return gulp.src(allScr)
             .pipe(jshint('.jshintrc'))
             .pipe(jshint.reporter('default'));
});

gulp.task('build:core', function() {
  return performBuild(coreSrc, jsDistName);
});

gulp.task('build:addons', function() {
  return performBuild(allScr, jsDistAddonsName);
});

gulp.task('build', ['build:core', 'build:addons']);

gulp.task('test:core', function() {
  return gulp.src(testRunnerCore).pipe(qunit());
});

gulp.task('test:addons', function() {
  return gulp.src(testRunnerAddons).pipe(qunit());
});

gulp.task('test:browser', function(){
  return gulp.src(testRunner).pipe(open('<% file.path %>')); 
});

gulp.task('test', ['test:core', 'test:addons']);

gulp.task('clean', function() {
  return del([distDest + '*']);
});

gulp.task('watch:src', function() {
  gulp.watch(jsSrc, ['lint', 'build']);
});

gulp.task('watch:tests', function() {
  gulp.watch(testScripts, ['test']);
});

gulp.task('watch', ['watch:src', 'watch:tests']);

gulp.task('default', ['clean', 'lint', 'build', 'test']);
