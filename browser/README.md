
<script type="text/javascript" src="http://domain.com/honcho/browser/api.js"></script>
<script type="text/javascript">

    // 0. setup the required base_url and site properties...
    honcho.base_url = 'http://domain.com/honcho';
    honcho.site = 'domain.com';

    to enable tracking from the client you'll need to properly initialize a module, page, or funnel test:

1. module testing...

    honcho.module('test_key');

    all module tests call multivar.module_cb via jsonp after the test data is loaded...
    you can also call an optional callback parameter after multivar.module_cb is fired

    honcho.module('test_key', function(){
        alert('awesome! I can put my hooks here.')
    })

2. page testing...
    pass this from your controller into your view so you can initialize the response from the rest call

    honcho.page({"name":"page_test","type":"p","variant":"a"}

3. funnel testing...
    pass this from your controller into your view so you can initialize the response from the rest call

    honcho.funnel({"name":"funnel_test","type":"f","variant":"a","step":"page_1","next_step":"page_2","state":"{\"name\":\"funnel_test\",\"type\":\"f\",\"variant\":\"a\",\"step\":\"page_1\",\"next_step\":\"page_2\"}"})

    call one of these below anytime after the test is initialized (above) :

4. variant event tracking...

    the variant is returned from the module or page test call above; just associate a key with it.
    multivar.track('test_key', 'event_name')

    w/ optional data collection arg

    honcho.track('test_key', 'event_name', {user:name,...})

5. bucket tracking (key, value)

    honcho.bucket('bucket_key', 'claimed')

    w/ optional data collection arg
    honcho.track('bucket_key', 'claimed', {user:name,...})

</script>
