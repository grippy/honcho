var keys = exports.keys = [];
var map = exports.map = {};

// constructor
var Key = function(name, path, handler) {
  this.name = name;
  this.path = path;
  // strip all :token() formats
  this.path_with_tokens = path.replace(/\(.\)/g, '');
  this.tokens = [];
  this.pattern = null;
  this.handler = handler;
  this.regify();
  return this;
}

// parses the pattern and creates the regexp groupings
Key.prototype.regify = function() {
  var parts = this.path.split('/');
  var grouping = [];
  var part, token;
  for (var i=0; i < parts.length; i++) {
    part = parts[i];
    if (part.indexOf(':') == 0) {
      token = part.replace(':', '');
      part = '(.*)';

      if (token.indexOf('*') > -1) {
        token = token.replace('*', '');

      } else if (token.indexOf('(') > -1) {
        var tmp = token.split('(');
        token = tmp[0];
        part = '(' + tmp[1].replace(")", "") + ')';
      }
      this.tokens.push(token);
    }
    grouping.push(part);
  }

  this.pattern = new RegExp("^"+grouping.join('/'))
}

// takes a path and breaks it up into params
Key.prototype.parse = function(path) {

  var grouping = this.pattern.exec(path)
  var params = {};

  for(var i=0; i < this.tokens.length; i++) {
    params[this.tokens[i]] = grouping[i + 1];
  }
  return params;
}

// given a set of params, returns the path version
Key.prototype.to_path = function(params) {
  var token;
  var params = params || {};
  var path = this.path_with_tokens;

  for (var i=0; i < this.tokens.length; i++) {
    token = this.tokens[i];

    path = path.replace(':'+ token, params[token]);
  }
  return path;
}

// creates a new key
exports.push = function(name, pattern, handler) {
  var k = new Key(name, pattern, handler);

  // add to the keys array
  keys.push(k);

  // map by name
  map[k.name] = k;

};

// sort the keys in reverse order
exports.finalize = function() {
  // sort descending
  this.keys.sort(function(a, b){
    return b.path.length - a.path.length;
  });
}

// returns a key from the specified path..
// {
//   key: key,
//   params: params (key parameters)
// }
exports.match = function(path) {
  for (var i=0, key; i < keys.length; i++) {
    key = keys[i];
    if (!key.pattern.test(path)) continue;
    return {
      key: key,
      params: key.parse(path),
      path: path
    };
  }
  return null;
}

/**
* key.to_path
* Lookup a key by name and convert the params to a string
* @name
* @params
**/
exports.to_path = function(name, params) {
  var key = map[name];
  if (!key) return null;
  return key.to_path(params);
}