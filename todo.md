## Break out stats into hours ##
  x - All times are stored in redis as GMT/UTC 0
  x - All times on the way out are localized using an offset if provided in the stats request
  x - All stats filter by start and end times

## Tests ##
  x - page, module, funnel, bucket
  x - page, module, funnerl, bucket stats

## Build ##
  x - Client library by version both regular and minified

## Client Library ##
  x - Middleware should serve this
  x   - /mount/browser/api.js

## Admin ##
  - create, reset, start, stop new tests
  - stats for existing tests

## User tracking ##
  - needs a guid
  - create a profile for a user
    - /s/domain.com/u/:id
      - user details {name, ...}

  - show all the stats by time for that user
    - /s/domain.com/u/:userid/pages
      - list of pages this user has viewed, with timestamp

## Realtime ##
    - pages
    /stats/realtime/p/:path

    - tests
    /stats/realtime/t/:path

## Time spent on page ##
  - ping an endpoint every few seconds and update a duration counter
  - /s/domain.com/page/:path*

## Bounce detection ##
  - figure out how to track back button clicks
  => https://github.com/cowboy/jquery-hashchange

## Page ##
  - /s/domain.com/p/:path/d/:date

## Country ##
  - /s/domain.com/countries
  - /s/domain.com/c/:country/:date

## IP's ##
  - /s/domain.com/ip
  - /s/domain.com/ip/:ip/d/:date

## Client error tracking ##
  - aggregate error stacks
