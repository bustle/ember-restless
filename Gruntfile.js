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

    modules: {
      core: {
        src: [
          'src/main/main.js',
          'src/main/attribute.js',
          'src/serializers/serializer.js',
          'src/serializers/json_serializer.js',
          'src/adapters/adapter.js',
          'src/adapters/rest_adapter.js',
          'src/main/client.js',
          'src/main/state.js',
          'src/main/model.js',
          'src/main/read_only_model.js',
          'src/main/record_array.js'
        ]
      },
      transforms: {
        src: [
          'src/ext/date.js',
          'src/ext/json_transforms.js'
        ]
      },
      fixtures: {
        src: [
          'src/adapters/fixture_adapter.js'
        ]
      }
    },

    jshint: {
      beforeconcat: ['gruntfile.js', 'src/**/*.js', 'tests/tests/*.js'],
      afterconcat: ['dist/<%= pkg.name %>.js', 'dist/<%= pkg.name %>+extras.js'],
      options: {
        forin: true,
        noarg: true,
        noempty: true,
        eqeqeq: true,
        bitwise: true,
        curly: true,
        browser: true,
        es5: true,
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
        footer: '<%= wrapClosure.footer %>'
      },

      dist: {
        get src() {
          var modules = grunt.config.data.modules;
          return modules.core.src.concat(modules.transforms.src);
        },
        dest: 'dist/<%= pkg.name %>.js'
      },

      extras: {
        get src() {
          var modules = grunt.config.data.modules;
          // TODO: loop
          return modules.core.src.concat(modules.transforms.src, modules.fixtures.src);
        },
        dest: 'dist/<%= pkg.name %>+extras.js'
      },

      custom: {
        files: { 'dist/<%= pkg.name %>.js' : [] }
      }
    },

    uglify: {
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      },
      extras: {
        files: {
          'dist/<%= pkg.name %>+extras.min.js': ['<%= concat.extras.dest %>']
        }
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
            'src/serializers',
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
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-contrib-clean');

  // Build task: Lint and build only
  grunt.registerTask('build', ['jshint:beforeconcat', 'concat:dist', 'concat:extras', 'jshint:afterconcat']);

  // Default task: Lint, build, test, build production
  grunt.registerTask('default', ['build', 'qunit', 'uglify']);

  // Test only task
  grunt.registerTask('test', ['qunit']);

  // Travis CI task: Build, lint, test
  grunt.registerTask('travis', ['concat:dist', 'concat:extras', 'jshint:afterconcat', 'qunit']);

  // Custom build task: Build with options to exclude files
  grunt.registerTask('custom', function(excludes) {
    var customArr = excludes.split(','),
        modules = grunt.config.data.modules,
        customSrcs = [];

    for(var i = 0; i < customArr.length; i++) {
      // TODO: support adding and removing
      customArr[i] = customArr[i].replace(/-/, '');
      delete modules[customArr[i]];
    }
    for(var module in modules) {
      if(modules.hasOwnProperty(module)) {
        customSrcs = customSrcs.concat(modules[module].src);
      }
    }

    grunt.config.data.concat.custom.files = {
      'dist/<%= pkg.name %>.js' : customSrcs
    };
    
    // TODO: run tests for custom builds
    grunt.task.run(['jshint:beforeconcat', 'concat:custom', 'jshint:afterconcat', 'uglify']);
  });
  
};
