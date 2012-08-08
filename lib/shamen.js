
var qs = require('querystring');
var fs = require('fs');

var _ = require('underscore');
var async = require('async');

var helpers = require('./helpers');
var models = require('./models');

var package = require('../package');

/*************************************/

// defaults
var redis = exports.redis = null;
var options = {
  redis_db: 0,
  redis_host: '127.0.0.1',
  redis_port: 6379,
  site: '',
  timezone: 0,
  crawlers: null
};

// local browser api paths
var browser_api_path =
  exports.browser_api_path = __dirname + '/../browser/api';

var browser_api_min_fd =
  exports.browser_api_min_fd = browser_api_path + '.min.js';

var browser_api_version_fd =
  exports.browser_api_version_fd = browser_api_path + '-' + package.version + '.js';

var browser_api_version_min_fd =
  exports.browser_api_version_min_fd = browser_api_path + '-' + package.version + '.min.js';

// cached items
var test_cache = {};
var bucket_cache = {};
var browser_api_cache = {};

/*************************************/

var NULL_CALLBACK = function(err, results) {};

var get_test = function(attrs, callback) {
  var test = test_cache[attrs.test_key];
  if (test) return callback(null, test);

  redis.hgetall(attrs.test_key, function(err, props) {
    var test = new models.Test(props);
    test_cache[attrs.test_key] = test;
    callback(err, test);
  });
}

var save_data = function(attrs) {
  var data = attrs.data;
  if (!data) return;

  // grab the date
  // data['_d'] = helpers.format_epoch(attrs.epoch);
  data['_d'] = attrs.hour;

  if (attrs.type === 'b') {
    data['_v'] = attrs.value;
  } else {
    data['_v'] = attrs.variant;
    data['_e'] = attrs.event;
    if (attrs.step) data['_s'] = attrs.step;
  }
  redis.lpush(attrs.data_key, JSON.stringify(data));
}

// test if the user agent string passes
// the crawler test
var is_crawler = function(attrs) {
  if (!options.crawlers || !attrs.user_agent) return false;

  var crawlers = options.crawlers;
  var ua = attrs.user_agent;
  var match = false;
  if (crawlers instanceof Array) {
    for (var i=0, ii=crawlers.length, re; i < ii; i++) {
      re = crawlers[i];
      if (re.test(ua)) {
        match = true;
        break;
      }
    }
  } else if (crawlers instanceof RegExp) {
    match = crawlers.test(ua);
  }
  return match;
}

// generate the default keys for all tests
// and stats
var default_test_attrs = function(attrs) {
  // attrs.epoch = helpers.epoch();
  attrs.hour = helpers.iso_hour();
  attrs.site = attrs.site || options.site;

  attrs.stats = _.defaults(attrs.stats || {}, {
    offset: 0,
    start_time: helpers.iso_day(),
    end_time: helpers.iso_day(1)
  });

  if (attrs.type === 'b') {
    attrs.test_key = ['/s',
                      attrs.site,
                      attrs.type,
                      attrs.name].join('/');

    attrs.data_key = ['/s',
                      attrs.site,
                      attrs.type,
                      'data'].join('/');



  } else {
    attrs.test_key = ['/s',
                      attrs.site,
                      attrs.type,
                      't',
                      attrs.name].join('/');

    attrs.data_key = [attrs.test_key, 'data'].join('/');

  }
  attrs.test_count_key = [attrs.test_key, 'count'].join('/');

  // should go
  // test_key /step / v/e
  var variant_date_key = [attrs.test_key];
  if (attrs.step) {
    variant_date_key.push('step');
    variant_date_key.push(attrs.step);
  }
  variant_date_key.push('v');
  variant_date_key.push(attrs.variant || ':variant');
  if (attrs.event) {
    variant_date_key.push('e')
    variant_date_key.push(attrs.event);
  }
  // variant_date_key.push(attrs.epoch);
  variant_date_key.push(attrs.hour);
  attrs.variant_date_key = variant_date_key.join('/');

  return attrs;
};

// the default test handler
// for page and module tests
var default_test_handler = function(attrs, next) {
  attrs = default_test_attrs(attrs);

  // default output for crawlers and inactive tests
  var output = {
    name: attrs.name,
    type: attrs.type,
    variant: 'a'
  };

  if (is_crawler(attrs)) {
    return next(null, output);
  }

  async.parallel({
    count: function(callback) {
      redis.incr(attrs.test_count_key, callback);
    },
    test: function(callback) {
      get_test(attrs, callback);
    }
  }, function(err, results) {

    var test = results.test;
    var test_count = results.count;

    if (!test) {
      return next(new Error('No test exists: ' + attrs.toString()));
    }
    if (test.active === 'false') {
      return next(null, output);
    };

    var position = test_count % 100;
    var variant = test.spread.charAt(position);
    output = {
      key: test.key,
      active: test.active,
      variant: variant,
      count: test_count,
      position: position
    };

    // return this now...
    next(null, output);

    // save the current epoch
    // test.add_date(attrs.epoch);
    test.add_date(attrs.hour);

    // update the variant count here...
    var variant_date_key =
      attrs.variant_date_key.replace(':variant', variant);

    redis.incr(variant_date_key);
  });

};


/**
* Init
*
* @options {
*   .redis_host
*   .redis_port
*   .redis_db
*   .redis        // instantiated node_redis client
*   .timezone: 0  // float for hours offset
*   .crawlers: [] // list of crawler user-agent regex expressions
* }
*
**/

exports.init = function(opts) {
  options = _.defaults(opts || {}, options);

  // check to make sure site was defined

  redis = options.redis;
  if (!redis) {
    redis = require('redis').createClient(
      options.redis_port, options.redis_host);

    if (options.redis_db !== 0){
      redis.select(options.redis_db, function(err, connected) {
        if (err) return console.error('=> Shamen failed to connect to redis', err);
        if (connected){
          console.log('=> Shamen connected to redis db' + options.redis_db);
        }
      });
    } else {
      console.log('=> Shamen connected to redis db' + options.redis_db);
    }
  }
  exports.redis = redis;
  models.init(redis, keys);

  return module.exports;
}

/**
* Page Test
*
**/
exports.page_test = function(attrs, callback) {
  attrs.type = 'p';
  default_test_handler(attrs, callback);
};

/**
* Module Test
*
**/
exports.module_test = function(attrs, callback) {
  attrs.type = 'm';
  default_test_handler(attrs, callback);
};

/**
* Funnel Test
* This will output a null step and next_step for crawlers and inactive tests
**/
exports.funnel_test = function(attrs, next) {

  attrs.type = 'f';
  if (attrs.state && typeof attrs.state === 'string') {
    attrs.state = JSON.parse(unescape(attrs.state));
  }

  // defaul attrs
  attrs = default_test_attrs(attrs);

  // default output for crawlers and inactive tests
  var output = {
    name: attrs.name,
    type: attrs.type,
    variant: 'a',
    step: null,
    next_step: null
  };

  // test for crawler
  if (is_crawler(attrs)) {
    return next(null, output);
  }

  var step,
      variant,
      test_step_key,
      forward = false;

  async.parallel({
      test: function(callback) {
        get_test(attrs, callback);
      },
    }, function(err, results) {

      var test = results.test;
      if (!test) {
        return next(new Error('No test exists: ' + attrs.toString()));
      }
      if (test.active === 'false') {
        return next(null, output);
      };

      if (attrs.state) {
        if (attrs.state.next_step) {
          step = attrs.state.next_step;
        }
        if (attrs.state.variant) {
          variant = attrs.state.variant;
        }
      }
      var first = test.first_step();
      if (!step) {
        step = first
      }
      if (step == first) forward = true;
      test_step_key = attrs.test_key + '/step/' + step;

      async.parallel({
        count: function(callback) {
          if (!forward) return callback(null, null);
          redis.incr(attrs.test_count_key, callback);
        }
      }, function(err, results) {
        var test_count = results.count;
        var position = test_count;
        if (test_count) {
          // count assumes this was just created so it's going to be off by 1
          variant = test.spread.charAt( (position) % 100 );
        }

        var output = {
          key: test.key,
          name: attrs.name,
          type: attrs.type,
          active: test.active,
          variant: variant,
          count: test_count,
          position: position,
          step: step,
          next_step: test.next_step(step)
        };

        output.state = JSON.stringify({
          name: attrs.name,
          variant: attrs.variant,
          step: step,
          next_step: test.next_step(step)
        });

        // return this now...
        next(null, output);

        // save the current epoch
        test.add_date(attrs.hour);

        // update the variant count here...
        var variant_date_key = test_step_key + '/v/' + variant + '/' + attrs.hour;
        redis.incr(variant_date_key);

      });
  });
};

/**
* Track
*
**/
exports.track = function(attrs, next) {

  // return early...
  next(null, null);

  // defaut test attrs...
  attrs = default_test_attrs(attrs);

  // test for crawlers
  if (is_crawler(attrs)) {
    return;
  }

  async.parallel({
    test: function(callback) {
      get_test(attrs, callback);
    }
  }, function(err, results) {
    var test = results.test;
    if (!test) {
      return next(new Error('No test exists: ' + attrs.toString()));
    }

    // should check if this test is event active
    if (test.active === 'false') {
      return;
    }

    // update event and date?
    // test.add_date(attrs.epoch);

    test.add_date(attrs.hour);
    test.add_event(attrs.event);

    // update the variant count here...
    redis.incr(attrs.variant_date_key);

    // save data...
    save_data(attrs);

  });
};

/**
* Bucket
*
**/

exports.bucket = function(attrs, next) {

  // hit callback now...
  next(null, null);

  attrs.type = 'b';

  // make sure we have a value to track here...
  if (!attrs.value && attrs.value.length == 0){
    return;
  }

  // defaut test attrs...
  attrs = default_test_attrs(attrs);

  // test for crawlers
  if (is_crawler(attrs)) {
    return;
  }

  // var bucket_date_key = attrs.test_key + '/' + attrs.epoch;
  var bucket_date_key = attrs.test_key + '/' + attrs.hour;

  // incr bucket date key
  redis.incr(bucket_date_key);

  // save data...
  save_data(attrs);

  // check to see if this is a new bucket key
  var name = attrs.name;
  var site_key = attrs.test_key.split('/b')[0];
  var site_buckets_key =  site_key + '/buckets';
  var bucket = bucket_cache[site_buckets_key];

  if (bucket) {
    if (bucket.indexOf(name) > -1) return;
    redis.sadd(site_buckets_key, name);
    bucket.push(name);
    bucket_cache[site_buckets_key] = bucket;
  } else {

    async.parallel({
        bucket: function(callback) {
          redis.smembers(site_buckets_key, callback);
        }
      }, function(err, results) {

        // grab the bucket members
        bucket = results.bucket;

        if (bucket.indexOf(name) == -1) {
          redis.sadd(site_buckets_key, name);
          bucket.push(name);
        }
        bucket_cache[site_buckets_key] = bucket;
      })
  };
}

/**
* Bucket Stats
*
**/

exports.bucket_stats = function(attrs, next) {

  attrs.type = 'b';
  attrs = default_test_attrs(attrs);

  var bucket_key = ['/s', attrs.site, 'b', attrs.name].join('/');

  async.auto({
    keys: function(callback) {
      redis.keys(bucket_key + '*', callback);
    },
    values: ['keys', function(callback, results) {
      var keys = results.keys;
      if (!keys.length) return callback(null, []);
      redis.mget(keys.sort(), callback);
    }]
  }, function(err, results) {

    var key,
        parts,
        key_changed,
        dt,
        count,
        dates = [],
        value,
        values = [],
        totals = {},
        date_totals = {},
        stats = {};

    var keys = results.keys;

    results.values.forEach(function(val, i){
        key = keys[i];
        parts = key.replace(bucket_key + '/', '').split('/');
        value=parts[0];
        // dt = helpers.format_epoch(parts[1]);
        dt = parts[1];

        if (dates.indexOf(dt) == -1) dates.push(dt);
        if (values.indexOf(value) == -1) values.push(value);
        if (val) {
          // just-in-case we have a key with no value
          count = parseInt(val, 10);
        } else {
          count = 0;
        }
        if (totals[value] === undefined){
          totals[value] = 0;
        }
        totals[value] += count;
        if(date_totals[dt] === undefined){
          date_totals[dt] = {};
        }
        if(date_totals[dt][value] === undefined){
          date_totals[dt][value] = 0;
        }
        date_totals[dt][value] += count
    })

    stats.site = attrs.site;
    stats.bucket = attrs.name;
    stats.dates = dates.sort();
    stats.values = values.sort();
    stats.value_totals = totals;
    stats.date_totals = date_totals;

    // callback
    next(null, stats);

  });
}


/**
* Test Stats
* Module, Page, and Funnel
**/

exports.stats_test = function(attrs, next) {
  attrs = default_test_attrs(attrs);
  var test_key = attrs.test_key;

  var dates = [];

  async.auto({
    test: function(callback) {
      get_test(attrs, callback);
    },
    keys: function(callback) {
      // we only care about variant keys here...
      var filter = function(err, keys) {
        keys = keys.filter(function(key) {
          if (key.indexOf('/v/') > -1) return key;
        });
        callback(err, keys);
      }

      // query all the test keys
      var keys = test_key;
      redis.keys(keys + '*', filter);
    },
    values: ['keys', function(callback, results) {

      var keys = results.keys;
      if (!keys.length) return callback(null, []);

      var start_time = helpers.iso_date(attrs.stats.start_time);
      var end_time = helpers.iso_date(attrs.stats.end_time);

      keys = _.filter(keys.sort(), function(key) {

        var iso = _.last(key.split('/'));
        var time = helpers.iso_date(iso);
        if (time >= start_time &&
            time <= end_time) {
          dates.push(iso);
          return key;
        }
      });

      if (!keys.length) return callback(null, keys);
      redis.mget(keys, callback);

    }]
  }, function(err, results) {

    var test = results.test;
    if (!test) {
      return next(new Error('No test exists: ' + attrs.toString()));
    }

    // copy over
    test.keys = results.keys;
    test.values = results.values;

    async.parallel({
      dates: function(callback) {
        callback(null, dates);
      },
      events: function(callback) {
        redis.smembers(test.events_key, callback);
      }
    }, function(err, results) {
      test.dates = results.dates;
      test.events = results.events;
      next(null, test.stats(attrs.stats));
    })

  });
}


/**
* Data Stats
* Module, Page, and Funnel
**/
// exports.stats_data = function(attrs, next) {

//   attrs = default_test_attrs(attrs);
//   var test_key = attrs.test_key

//   async.auto({
//     stats: function(callback) {

//     }
//   }, function(err, results) {

//   });
// }


/*************************************/

var keys = exports.keys = require('./keys');

// Instantiate our key patterns here...

// buckets
keys.push('bucket', '/s/:site/:type(b)/:name/:value');
// keys.push('bucket_data', '/s/:site/:type(b)/data');
keys.push('bucket_value_date', '/s/:site/:type(b)/:name/:value/:date');

// modules
keys.push('module_count', '/s/:site/:type(m)/t/:name/count');
keys.push('module_events', '/s/:site/:type(m)/t/:name/events');
keys.push('module_dates', '/s/:site/:type(m)/t/:name/dates');
keys.push('module_data', '/s/:site/:type(m)/t/:name/data');
keys.push('module_test', '/s/:site/:type(m)/t/:name', exports.module_test);
keys.push('module_track', '/s/:site/:type(m)/t/:name/v/:variant/e/:event', exports.track);
keys.push('module_variant_date', '/s/:site/:type(m)/t/:name/v/:variant/:date');
keys.push('module_event_date', '/s/:site/:type(m)/t/:name/v/:variant/e/:event/:date');

// pages
keys.push('page_count', '/s/:site/:type(p)/t/:name/count');
keys.push('page_events', '/s/:site/:type(p)/t/:name/events');
keys.push('page_dates', '/s/:site/:type(p)/t/:name/dates');
keys.push('page_data', '/s/:site/:type(p)/t/:name/data');
keys.push('page_test', '/s/:site/:type(p)/t/:name', exports.page_test);
keys.push('page_track', '/s/:site/:type(p)/t/:name/v/:variant/e/:event', exports.track);
keys.push('page_variant_date', '/s/:site/:type(p)/t/:name/v/:variant/:date');
keys.push('page_event_date', '/s/:site/:type(p)/t/:name/v/:variant/e/:event/:date');

// funnels
keys.push('funnel_count', '/s/:site/:type(f)/t/:name/count');
keys.push('funnel_events', '/s/:site/:type(f)/t/:name/events');
keys.push('funnel_dates', '/s/:site/:type(f)/t/:name/dates');
keys.push('funnel_data', '/s/:site/:type(f)/t/:name/data');
keys.push('funnel_test', '/s/:site/:type(f)/t/:name', exports.funnel_test);
keys.push('funnel_track', '/s/:site/:type(f)/t/:name/step/:step/v/:variant/e/:event', exports.track);
keys.push('funnel_variant_date', '/s/:site/:type(f)/t/:name/step/:step/v/:variant/:date');
keys.push('funnel_event_date', '/s/:site/:type(f)/t/:name/step/:step/v/:variant/e/:event/:date');

// stats
keys.push('stats_test', '/stats/test/:key*', function(attrs, next) {
  var match = keys.match('/' + attrs.key);
  if (!match) return next(new Error('Unknown key structure'));
  match.params.stats = attrs.stats;
  exports.stats_test(match.params, next);
});

keys.push('stats_data', '/stats/data/:key*', function(attrs, next) {
  var match = keys.match('/' + attrs.key);
  if (!match) return next();
  match.params.stats = attrs.stats;
  exports.stats_data(match.params, next);
});

// sort the keys
keys.finalize();

/*************************************/


/**
* Browser Api
* Loads and returns the browser api by version
**/
exports.browser_api = function(version, next) {
  var cached = browser_api_cache[version];
  if (cached) return next(null, cached);

  var fd = __dirname + '/../browser/' + version;
  fs.readFile(fd, function (err, file) {
    if (err) return next(err);
    file = file.toString();
    next(err, file);
    browser_api_cache[version] = file;
  });
};


/**
* Express/Connect Middleware
*
**/
exports.middleware = function(options) {

  if (options) {
    if (options.mount && options.mount.indexOf('/') !== 0) {
      throw new Error('middleware mount must start with "/"');
    }
  }

  return function (req, res, next) {
    // grab the path name only
    var url = req._parsedUrl.pathname;

    // remove the mount from the url
    if (options.mount && options.mount.length > 1) {
      url = url.replace(options.mount, '');
    }

    // return the browser api?
    if (url.indexOf('/browser/api') > -1) {
      exports.browser_api(url.split('/browser/')[1], function(err, results) {
        // set content-type
        res.set('content-type', 'text/javascript');
        res.send(results);
      });
      return;
    }

    // all routes should have /s/ site token
    if (url.indexOf('/s/') == -1) return next();

    var match = keys.match(url);
    if (!match) return next();

    var handler = match.key.handler;
    if (!handler) return next();

    // the request method
    var method = req.method;

    // grab the route params
    var attrs = match.params || {};

    // add user agent
    attrs.user_agent = req.headers['user-agent'];

    // localize stats
    attrs.stats = {
      offset: req.query.offset,
      start_time: req.query.start_time,
      end_time: req.query.end_time
    };

    // parse data
    if (req.query.data) {
      try {
        attrs.data = qs.parse(unescape(req.query.data));
      } catch(e) {};
    }

    // add state params for funnel tests
    var state = req.query.state;
    if (state) {
      try {
        attrs.state = JSON.parse(unescape(state));
      } catch(e) {};
    }

    handler(attrs, function(err, results) {
      if (err) return res.send(500);
      if (!results) return res.send(200);

      // do we have a jsonp request?
      var jsonp = req.query.callback;
      if (jsonp) {
        results = jsonp + '(' + JSON.stringify(results) + ');';
      }
      return res.send(results);
    });

  };
};