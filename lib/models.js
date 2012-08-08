var _ = require('underscore');
var async = require('async');
var helpers = require('./helpers');

var redis;
var redis_keys;

exports.init = function(client, keys) {
  redis = client;
  redis_keys = keys;
};

/**
*
* models.Test
*
**/
var Test = exports.Test = function(props) {

  // defatuls
  this.active = false;
  this.steps = '';
  this.dates = [];
  this.events = [];
  this.keys = [];
  this.values = [];

  // copy the props over
  _.extend(this, props);

  this.key = ['/s', this.site, this.type, 't', this.name].join('/');
  this.dates_key = [this.key, 'dates'].join('/');
  this.events_key = [this.key, 'events'].join('/');

  return this;
};

Test.prototype = {
  key: null,
  active: null,
  site: null,
  name: null,
  type: null,
  variants: null,
  distribution: null,
  spread: null,
  steps: null,
  dates: null,
  events: null,
  keys: null,
  values: null
};

Test.prototype.validate = function() {};

// hopefully the model is cached so we only
// save the date once...
Test.prototype.add_date = function(epoch) {
  if (this.dates.indexOf(epoch) > -1) return;
  this.dates.push(epoch);
  redis.sadd(this.dates_key, epoch);
};

Test.prototype.add_event = function(event) {
  if (this.events.indexOf(event) > -1) return;
  this.events.push(event);
  redis.sadd(this.events_key, event);
};

Test.prototype.first_step = function() {
  if (!this._first_step) {
    this._first_step = this.steps.split(',')[0];
  }
  return this._first_step;
};

Test.prototype.next_step = function(s) {
  var parts = this.steps.split(',');
  var i = parts.indexOf(s);
  if (i < parts.length - 1) {
    return parts[i+1];
  }
  return null;
};

Test.prototype.conversion_rate = function(ecnt, imp){
  return parseFloat(((ecnt / imp) * 100).toFixed(2))
};

Test.prototype.stats = function(options) {
  options = options || {};

  if (this.type !== 'f') {
    return this.page_or_module_stats(options);
  } else {
    return this.funnel_stats(options);
  }
};

Test.prototype.page_or_module_stats = function(options) {
  var test_key = this.key;
  var dates = this.dates;
  var values = this.values;
  var events = this.events;
  var keys = this.keys;
  var variants = this.variants.split(',');

  var v_key, e_key, d_key;
  var v_val, e_val, d_val;
  var val;
  var v_totals = {};
  var v_dates = {};
  var v_events=[];
  var e_totals = {};
  var e_dates = {};
  var v_total=0, e_total=0; // total of each type
  var v, e, d;
  var variant_event_name;
  var c_totals = {} // conversion totals
  var date_formats = [], date_format;

  // easy lookup for our dates;
  var stats = {};
  for (var i=0, ii = keys.length; i < ii; i++){
    stats[keys[i]] = parseInt(values[i], 10);
  }

  for(var i=0; i < variants.length; i++){
    v = variants[i];
    v_key = test_key + '/v/' + v;
    v_totals[v] = 0;

    // grab all the variants by saved dates
    for(var k=0; k < dates.length; k++){
      d = dates[k];
      d_key = v_key + '/' + dates[k];

      val = stats[d_key] || 0;

      // localize the date
      date_format = helpers.iso_offset(d, options.offset);

      v_totals[v] += val
      v_total += val;

      if (v_dates[date_format] === undefined){
        v_dates[date_format] = {};
      }
      if (v_dates[date_format][v] === undefined){
        v_dates[date_format][v] = 0;
      }
      v_dates[date_format][v] += val;

      if (date_formats.indexOf(date_format) == -1) {
        date_formats.push(date_format);
      }
    }

    // grab all the variants and events by saved dates
    for(var j=0; j < events.length; j++){
      e = events[j];
      e_key = v_key + '/e/' + e;

      for(var k=0; k < dates.length; k++){
        d = dates[k];
        d_key = e_key + '/' + dates[k];

        val = stats[d_key] || 0;
        variant_event_name = v + '/' + e

        // localize the dates
        date_format = helpers.iso_offset(d, options.offset);

        if (e_totals[variant_event_name] == undefined && val > 0){
          e_totals[variant_event_name] = 0;
        }
        if(val > 0) {
          e_totals[variant_event_name] += val;
          c_totals[variant_event_name] = this.conversion_rate(val, v_totals[v]);
          v_events.push(variant_event_name);
        }
        e_total += val
        if (e_dates[date_format] == undefined) {
          e_dates[date_format] = {};
        }
        // only add if we have a value (keeps response minimal)
        if (val>0) e_dates[date_format][variant_event_name] = val
      }
    }
  }

  return {


    test: {
      site: this.site,
      name: this.name,
      type: this.type,
      key: this.key,
      active: this.active,
      distribution: this.distribution,
      variants: variants,
      events: this.events
    },

    stats: {
      offset: options.offset,
      start_time: helpers.iso_offset(options.start_time, options.offset),
      end_time: helpers.iso_offset(options.end_time, options.offset),
      dates: date_formats,
      variant_total: v_total,
      variant_totals: v_totals,
      variant_dates: v_dates,
      variant_events: _.uniq(v_events),
      conversion_totals: c_totals,
      event_total: e_total,
      event_totals: e_totals,
      event_dates: e_dates

    }
  };
}

Test.prototype.funnel_stats = function(options) {

  var test_key = this.key;
  var dates = this.dates;
  var values = this.values;
  var events = this.events;
  var keys = this.keys;
  var variants = this.variants.split(',');
  var steps = this.steps.split(',');

  var params, parts, key, count;

  var v_totals = {}
  var v_dates = {}, v_date;

  var e_totals = {}
  var e_dates = {}, e_date, date;

  var v_total=0, e_total=0; // total of each type
  var s_totals={}; // step totals (sum across all variants)
  var sv_totals={}; // step variant totals (for each step/variant)
  var sv_events = []
  var c_totals = {} // conversion totals
  var date_formats = [], date_format;

  var event_params = [];
  var variant_params = [];
  var step_variant, step_variant_event;

  for(var i=0; i < dates.length; i++){
    date_format = helpers.iso_offset(dates[i], options.offset);
    date_formats.push(date_format);
  }

  // easy lookup for our dates;
  var stats = {};
  for (var i=0, ii = keys.length; i < ii; i++){
    stats[keys[i]] = parseInt(values[i], 10);
  }

  // seperate events from variant keys...
  for(var i=0; i < keys.length; i++) {
    key = keys[i];
    match = redis_keys.match(key);
    if (match) {
      if (match.params.event) {
        event_params.push(match);
      } else {
        variant_params.push(match);
      }
    }
  };

  for(var i=0; i < variant_params.length; i++) {
    key = variant_params[i].path;
    param = variant_params[i].params;
    count = stats[key];

    step_variant = param.step + '/' + param.variant;

    if (v_totals[param.variant] == undefined) {
      v_totals[param.variant] = 0;
    }

    v_totals[param.variant] += count;
    v_total += count;

    // localize the date
    date = helpers.iso_offset(param.date, options.offset);

    if (v_dates[date] == undefined) {
      v_dates[date] = {};
    }

    v_date = v_dates[date];
    v_date[step_variant] = count;
    v_dates[date] = v_date;

    if (s_totals[param.step] == undefined) {
      s_totals[param.step] = 0
    }
    s_totals[param.step] += count;

    if (sv_totals[step_variant] == undefined) {
      sv_totals[step_variant] = 0
    }
    sv_totals[step_variant] += count;
  }

  for(var i=0; i < event_params.length; i++) {
    key = event_params[i].path;
    param = event_params[i].params;
    count = stats[key];

    step_variant = param.step + '/' + param.variant;
    step_variant_event = param.step + '/' + param.variant + '/' + param.event;

    if (e_totals[step_variant_event] == undefined) {
      e_totals[step_variant_event] = 0;
    }
    e_totals[step_variant_event] += count;
    e_total += count;

    // localize the date
    date = helpers.iso_offset(param.date, options.offset);

    if (e_dates[date] == undefined){
      e_dates[date] = {};
    }
    e_date = e_dates[date];
    e_date[step_variant_event] = count;
    e_dates[date] = e_date;

    c_totals[step_variant_event] = this.conversion_rate(count, sv_totals[step_variant]);
    sv_events.push(step_variant_event);
  }

  return {

    test: {
      site: this.site,
      name: this.name,
      type: this.type,
      key: this.key,
      active: this.active,
      distribution: this.distribution,
      variants: variants,
      events: this.events,
      steps: steps
    },

    stats: {
      offset: options.offset,
      start_time: helpers.iso_offset(options.start_time, options.offset),
      end_time: helpers.iso_offset(options.end_time, options.offset),
      dates: date_formats,
      variant_total: v_total,
      variant_totals: v_totals,
      variant_dates: v_dates,
      step_totals: s_totals,
      step_variant_totals: sv_totals,
      step_variant_events: _.uniq(sv_events),
      conversion_totals: c_totals,
      event_total: e_total,
      event_totals: e_totals,
      event_dates: e_dates
    }
  }
}




