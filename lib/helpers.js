var _ = require('underscore');


var options = {
  // what offset is the server running in?
  server_offset: parseFloat(-(new Date().getTimezoneOffset() / 60))
};

// convert the current local time to utc
// with zero hours, minutes, seconds, and milliseconds
// @from_today - the date we should
//               return releative to current time
//
var iso_day = exports.iso_day = function(from_today) {
  var dt = new Date();
  if (from_today) {
    dt.setUTCDate(dt.getUTCDate() + from_today);
  }
  dt.setUTCHours(0, 0, 0, 0);
  return iso_offset(dt, 0);
}

// convert the current local time to utc
// with zero minutes, seconds, and milliseconds
var iso_hour = exports.iso_hour = function(from_today) {
  var dt = new Date();
  if (from_today) {
    dt.setUTCDate(dt.getUTCDate() + from_today);
  }
  dt.setUTCMinutes(0, 0, 0);
  return iso_offset(dt, 0);
}

// convert the current local time to utc
// with zero seconds, and milliseconds
var iso_minute = exports.iso_minute = function(from_today) {
  var dt = new Date();
  if (from_today) {
    dt.setUTCDate(dt.getUTCDate() + from_today);
  }
  dt.setUTCSeconds(0, 0);
  return iso_offset(dt, 0);
}

// take the current system time and create
// a local time using the offset
var iso_now = exports.iso_now = function(offset) {
  return iso_offset(new Date(), offset);
}

var iso_date = exports.iso_date = function(iso) {
  return new Date(iso);
}

var date_now = exports.date_now = function(offset) {
  return new Date(iso_now(offset));
}

// takes an iso formatted date string
// and determines the hours and minutes offsets
// as ints
var offsets = function(iso) {
  // we need remove the last five chars
  // this should hold the timezone info
  // node dates default to 'Z' so this should work with
  // specified timezones

  var offsets = {
    hours: 0,
    minutes: 0
  };
  if (iso.indexOf('-') > -1 || iso.indexOf('+') > -1) {
    offset = iso.substr(iso.length-6, iso.length);
    var parts = offset.split(':');
    var offset_hour = parseInt(parts[0], 10);
    var offset_minute = parseInt(parts[1], 10);

    offsets = {
      hours: offset_hour,
      minutes: offset_minute
    }
  }
  return offset;
}

// Takes a date or iso formatted string
// and adjusts it to the specified offset
var iso_offset = exports.iso_offset = function(dt, offset) {
  offset = offset || 0;

  // take the iso date string and init as a date
  if (_.isString(dt)) dt = new Date(dt);

  // this should take into account our date might not be UTC
  // later, though
  if (offset) {
    dt = new Date( dt.getTime() + (offset * 60 * 60 * 1000) );
  }

  var iso = dt.toISOString();
  var offset = parseFloat(offset);
  var offset_hour = (offset > 0) ? Math.floor(offset) : Math.ceil(offset);
  var offset_minute = 0;
  var remainder = parseFloat(parseFloat(offset) - offset_hour);
  if (remainder) {
    offset_minute = 60 * remainder;
  }

  offset_hour = Math.abs(offset_hour);
  offset_minute = Math.abs(offset_minute);

  offset_hour = (offset_hour < 10) ?
                  '0' + offset_hour :
                  offset_hour.toString();

  offset_minute = (offset_minute < 10) ?
                  '0' + offset_minute :
                  offset_minute.toString();

  var offset_string = ((offset >= 0) ? '+' : '-') +
                      offset_hour +
                      ':' +
                      offset_minute;

  return iso.replace('Z', offset_string);

}
