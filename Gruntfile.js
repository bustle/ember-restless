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
          'src/main.js',
          'src/attribute.js',
          'src/serializers/serializer.js',
          'src/serializers/json_serializer.js',
          'src/adapters/adapter.js',
          'src/adapters/rest_adapter.js',
          'src/client.js',
          'src/state.js',
          'src/model.js',
          'src/read_only_model.js',
          'src/record_array.js'
        ]
      },
      transforms: {
        src: [
          'src/ext/date.js',
          'src/ext/json_transforms.js'
        ]
      }
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
        es5: true,
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
        get src() {
          var modules = grunt.config.data.modules;
          return modules.core.src.concat(modules.transforms.src);
        },
        dest: 'dist/<%= pkg.name %>.js'
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
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');

  // Default task: Lint, build, test, build production
  grunt.registerTask('default', ['jshint:beforeconcat', 'concat:dist', 'jshint:afterconcat', 'qunit', 'uglify']);

  // Build task: Lint and build only
  grunt.registerTask('build', ['jshint:beforeconcat', 'concat:dist', 'jshint:afterconcat']);

  // Travis CI task: Build, lint, test
  grunt.registerTask('travis', ['concat:dist', 'jshint:afterconcat', 'qunit']);

  // Custom build task: Build with options to exclude files
  grunt.registerTask('custom', function(excludes) {
    var excludeArr = excludes.split(','),
        modules = grunt.config.data.modules,
        customSrcs = [];

    for(var i = 0; i < excludeArr.length; i++) {
      excludeArr[i] = excludeArr[i].replace(/-/, '');
      delete modules[excludeArr[i]];
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
