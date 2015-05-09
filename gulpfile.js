var del       = require('del');
var gulp      = require('gulp');
var jshint    = require('gulp-jshint');
var qunit     = require('gulp-qunit');
var replace   = require('gulp-replace');
var transpile = require('esperanto');
var header    = require('gulp-header');
var open      = require('gulp-open');
var file      = require('gulp-file');
var pkg       = require('./package.json');

// ------------------------------------------- 

var allSrc = ['src/**/*.js'];
var coreEntry = 'src/index.js';

var distDest = './dist/';
var jsDistName = 'ember-restless.js';

var testRunnerCore = './tests/index.html';
var testScripts = './tests/tests/*.js';

var banner = ['/**',
              ' * <%= pkg.name %>',
              ' * @overview  <%= pkg.description %>',
              ' * @version   <%= pkg.version %>',
              ' * @author    <%= pkg.author %>',
              ' * @license   <%= pkg.license %>',
              ' * @copyright (c) 2013-2015 Bustle Labs',
              ' */',
              ''].join('\n');

var iifeHeader = '\n(function(Ember, undefined) {\n\n  \'use strict\';\n\n';
var iifeFooter = '\n\n}(Ember));\n';

function performBuild(entryFile, outputFile) {
  return transpile.bundle({
    entry: entryFile
  }).then(function(bundle) {
    var transpiled = bundle.concat({
      intro: iifeHeader,
      outro: iifeFooter
    });
    return file(outputFile, transpiled.code, { src: true })
               .pipe(replace(/@@version/g, pkg.version))
               .pipe(header(banner, { pkg : pkg } ))
               .pipe(gulp.dest(distDest));
  });
}

gulp.task('lint', function() {
  return gulp.src(allSrc)
             .pipe(jshint('.jshintrc'))
             .pipe(jshint.reporter('default'));
});

gulp.task('build:core', ['clean', 'lint'], function() {
  return performBuild(coreEntry, jsDistName);
});

gulp.task('build', ['clean', 'lint', 'build:core']);

gulp.task('test:core', ['build:core'], function() {
  return gulp.src(testRunnerCore).pipe(qunit());
});

gulp.task('test:browser', function(){
  return gulp.src(testRunnerCore).pipe(open('<% file.path %>')); 
});

gulp.task('test', ['build', 'test:core']);

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

gulp.task('default', ['build', 'test']);
