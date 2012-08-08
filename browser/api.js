
var shamen = {

  base_url: null,
  site: null,
  tests: {},
  callbacks: {},
  cookies: {},

  $:function(id){
    return document.getElementById(id);
  },

  script:function(src) {
    var h = document.getElementsByTagName('head')[0];
    var s = document.createElement('script');
    s.setAttribute('type','text/javascript');
    s.setAttribute('src', src);
    h.appendChild(s);
  },

  set_cookie: function( name, value, expires ) {

    name = "shamen_" + name
    var today = new Date(),
        path = '',
        secure = null;
    today.setTime(today.getTime());
    expires = (expires !== undefined) ? expires:1 * (1000 * 60 * 60 * 24); // days
    var expires_date = new Date( today.getTime() + (expires) );
    var cookie = name + "=" +escape( value ) +
    ( ( expires ) ? ";expires=" + expires_date.toGMTString() : "" );
    // ( ( path ) ? ";path=" + path : "" ) +
    // ( ( domain ) ? ";domain=" + domain : "" ) +
    // ( ( secure ) ? ";secure" : "" );
    document.cookie = cookie;
  },

  delete_cookie: function(name) {
    this.set_cookie(name, null, -1);
  },

  cookie: function(name) {
    var cookie_name = 'shamen_' + name;
    var exists = RegExp(cookie_name+'=');
    if (exists.test(document.cookie)) {
      var re = RegExp('^' + cookie_name);
      var cookies = document.cookie.split( ';' ), cookie = '';
      var parts;
      for ( i = 0; i < cookies.length; i++ ) {
        cookie=cookies[i].replace(/^\s+|\s+$/g, ''); // remove white space from beg and end
        if (re.test(cookie)){
          parts = cookie.split('=');
          return unescape(parts[1]);
        }
      }
    }
    return null;
  },

  init: function(site) {
    this.site = site;
  },

  filter:function(s) {
    return s.replace(/\//g,'-');
  },

  test_key_url:function(t, k) {
    return [this.base_url,
            's', this.site,
            this.filter(t),
            't',
            this.filter(k)].join('/');
  },

  test_variant_event_key_url: function(t, k, v, e) {
    return [this.test_key_url(t,k),
            'v',
            this.filter(v),
            'e',
            this.filter(e)].join('/');
  },

  test_funnel_variant_event_key_url: function(t, k, s, v, e){
    return [this.test_key_url(t,k),
            'step',
            this.filter(s),
            'v',
            this.filter(v),
            'e',
            this.filter(e)].join('/');
  },

  bucket_key_url: function(k, v) {
    return [this.base_url,
            's',
            this.site,
            'b',
            this.filter(k),
            this.filter(v)].join('/');
  },

  module:function(key) {
    // initial this test...
    // do we have a callback to perform after the module is loaded?
    if(arguments[1] !== undefined){
     this.callbacks[key] = arguments[1];
    }
    var test_key_url = this.test_key_url('m', key)
    this.script(test_key_url + '?jsonp=shamen.module_callback' )
  },

  module_callback: function(result) {
    this.tests[result.name] = result;
    var variant_container = result.name + '_' + result.variant;
    var el = this.$(variant_container);
    if (el){
      el.style.display = '';
    }
    var cb = this.callbacks[result.name];
    if (cb !== undefined){
      cb();
    }
  },

  page: function(result) {
    // initial this test...
    this.tests[result.name] = result;
  },

  funnel:function(result) {
    this.tests[result.name] = result;
    if(result.next_step){
      this.set_cookie(result.name, result.state)
    } else {
      this.delete_cookie(result.name)
    }
  },

  track: function(t, e) {
    var test = this.tests[t]
    var track_url;
    if (test.type !== 'f'){
      track_url = this.test_variant_event_key_url(test.type, t, test.variant, e);
    } else if (test.type === 'f') {
      track_url =
        this.test_funnel_variant_event_key_url(test.type, t, test.step, test.variant, e);
    }
    var data;
    if(arguments[2] !== undefined) {
      data = this.data_params(arguments[2]);
    }
    if (track_url) {
      if(data) {track_url += '?data=' + data};
      this.script(track_url);
    }
  },

  bucket: function(k, v) {
    var data;
    if(arguments[2]!=undefined){
      data = this.data_params(arguments[2]);
    }
    var url = this.bucket_key_url(k, v);
    if(data) {url += '?data=' + data};
    this.script(url);
  },

  data_params: function(o) {
    var parts = [];
    for(var p in o) {
      parts.push(p + '=' + o[p]);
    }
    if (!parts.length) return null;
    return escape(parts.join('&'));
  }
}