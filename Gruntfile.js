module.exports = function(grunt) {

  'use strict';

  var coreSrc = [
    'src/main/main.js',
    'src/main/attribute.js',
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
    'src/main/client.js',
    'src/main/state.js',
    'src/main/model.js',
    'src/main/read_only_model.js',
    'src/main/record_array.js',
    'src/ext/date.js'
  ];

  var addonsSrc = [
    'src/addons/fixture_adapter.js',
    'src/addons/ls_adapter.js'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    projectInfo:  '/**\n * <%= pkg.name %>\n' +
                  ' * <%= pkg.description %>\n' +
                  ' *\n' +
                  ' * version: <%= pkg.version %>\n' +
                  ' * last modifed: <%= grunt.template.today("yyyy-mm-dd") %>\n' +
                  ' *\n' +
                  ' * Garth Poitras <garth22@gmail.com>\n' +
                  ' * Copyright (c) 2013-2014 Bustle Labs.\n' +
                  ' */\n',

    wrapClosure: {
      header: '(function(window, $, Ember, undefined){\n\n' +
              '\'use strict\';\n\n',
      footer: '\n})(this, jQuery, Ember);'
    },

    jshint: {
      beforeconcat: ['gruntfile.js', 'src/**/*.js', 'tests/tests/*.js'],
      afterconcat: ['dist/<%= pkg.name %>.js', 'dist/<%= pkg.name %>+addons.js'],
      options: {
        forin: true,
        noarg: true,
        noempty: true,
        eqeqeq: true,
        bitwise: true,
        curly: true,
        browser: true,
        es3: true,
        globals: {
          jQuery: true,
          Ember: true
        }
      }
    },

    qunit: {
      files: ['tests/*.html']
    },

    concat: {
      options: {
        banner: '<%= projectInfo %>\n' + 
                '<%= wrapClosure.header %>',
        footer: '<%= wrapClosure.footer %>',
        version: '<%= pkg.version %>',
        process: function(src, filepath) {
          if(filepath === 'src/main/main.js') {
            return src.replace('@@version', this.version);
          }
          return src;
        }
      },

      dist: {
        src: coreSrc,
        dest: 'dist/<%= pkg.name %>.js'
      },

      addons: {
        src: coreSrc.concat(addonsSrc),
        dest: 'dist/<%= pkg.name %>+addons.js'
      }
    },

    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          paths: [
            'src/main',
            'src/adapters',
            'src/serializers'
          ],
          outdir: 'docs',
          themedir: 'docs-theme',
          helpers: ['docs-theme/helpers/helpers.js']
        }
      }
    },

    clean: ['dist', 'docs']

  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-contrib-clean');

  // Build task: Lint, concat
  grunt.registerTask('build', ['jshint:beforeconcat', 'concat:dist', 'concat:addons', 'jshint:afterconcat']);

  // Default task: Build, test
  grunt.registerTask('default', ['build', 'test']);

  // Test only task
  grunt.registerTask('test', ['qunit']);

  // Travis CI task: default
  grunt.registerTask('ci', ['default']);
};
