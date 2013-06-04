module.exports = function(grunt) {

  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    projectInfo:  '/**\n * <%= pkg.name %>\n' +
                  ' * <%= pkg.description %>\n' +
                  ' *\n' +
                  ' * version: <%= pkg.version %>\n' +
                  ' * last modifed: <%= grunt.template.today("yyyy-mm-dd") %>\n' +
                  ' *\n' +
                  ' * Garth Poitras <garth22@gmail.com>\n' +
                  ' * Copyright (c) 2013 Endless, Inc.\n' +
                  ' */\n',

    wrapClosure: {
      header: '(function(window, $, Ember, undefined){\n\n' +
              '"use strict";\n\n',
      footer: '\n})(this, jQuery, Ember);'
    },

    jshint: {
      beforeconcat: ['gruntfile.js', 'src/**/*.js'],
      afterconcat: ['dist/<%= pkg.name %>.js'],
      options: {
        forin: true,
        noarg: true,
        noempty: true,
        eqeqeq: true,
        bitwise: true,
        curly: true,
        browser: true,
        //undef: true,
        //unused: true,
        globals: {
          jQuery: true,
          Ember: true
        }
      }
    },

    qunit: {
      files: ['tests/index.html']
    },

    concat: {
      options: {
        banner: '<%= projectInfo %>\n' + 
                '<%= wrapClosure.header %>',
        footer: '<%= wrapClosure.footer %>'
      },
      dist: {
        src: [
          'src/main.js',
          'src/attribute.js',
          'src/serializers/serializer.js',
          'src/serializers/json_serializer.js',
          'src/adapters/adapter.js',
          'src/adapters/rest_adapter.js',
          'src/client.js',
          'src/state.js',
          'src/model.js',
          'src/array.js',
          // optional files: group can be excluded to reduce filesize
          'src/read_only_model.js',
          'src/ext/date.js',
          'src/ext/json_transforms.js'
          // end: optional
        ],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },

    uglify: {
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');

  // Default task: Lint, build, test, build production
  grunt.registerTask('default', ['jshint:beforeconcat', 'concat', 'jshint:afterconcat', 'qunit', 'uglify']);

  // Build task: Lint and build only
  grunt.registerTask('build', ['jshint:beforeconcat', 'concat', 'jshint:afterconcat']);

  // Travis CI task: Build, lint, test
  grunt.registerTask('travis', ['concat', 'jshint:afterconcat', 'qunit']);
  
};
