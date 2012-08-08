var fs = require('fs');

var async = require('async');
var ugly = require('uglify-js');

var honcho = require('./honcho');

var exit = function(code) {
  process.exit(code || 0);
}

var minify = function(s) {
  var code = ugly.parser.parse(s);
  code = ugly.uglify.ast_mangle(code);
  code = ugly.uglify.ast_squeeze(code);
  return ugly.uglify.gen_code(code);
};

var read = function(fd, next) {
  console.log('Reading: ', fd);
  fs.readFile(fd, function (err, file) {
    if (err) throw err;
    next(null, file.toString());
  });
};

var write = function(fd, file, next) {
  console.log('Write: ', fd);
  fs.writeFile(fd, file, function (err) {
    if (err) throw err;
    next();
  });
};

async.auto({
  browser_api: function(callback) {
    read( honcho.browser_api_path + '.js', callback);
  },

  browser_api_minify: ['browser_api', function(callback, results) {
    var minified = minify(results.browser_api);
    write(honcho.browser_api_min_fd, minified, callback);
  }],

  version_browser_api_minify: ['browser_api', function(callback, results) {
    var minified = minify(results.browser_api);
    write(honcho.browser_api_version_min_fd, minified, callback);
  }],

  version_browser_api: ['browser_api', function(callback, results) {
    write(honcho.browser_api_version_fd, results.browser_api, callback);
  }],

}, function(err, results) {
      exit();
});

