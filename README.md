[grippy - 08/07/2012] Just pushed the repo. Detting a few more things in order before this is ready.

# Multivariate, A/B, Bucket Testing Library
  - This library is a big rewrite of my other library node-multivariate.
  - Uses Redis for all data storage.
  - Same concepts; But is now a standalone library without needing to run a separate http server.
  - Exposes most of its functionality as middleware.

## Module
  Easily test components of a page.

  - The page rendered from your server should always render control.
  - Uses the browser to request which variant to display and then makes the switch.
  - Has callback hooks which make this extremely flexible.
  - Use it to render variant stylesheets, images, etc.

## Page
  Want to test a completely different version(s) of a page?

## Funnels
  Basically, this is just a multi-step page test.

  - String a series of pages together and make the variant sticky.
  - Track progress along the way.
  - Uses a cookie to transfer state.

## Events
  Modules, Pages, and Funnel tests also aggregate variant event tracking.

  - This allows you to track conversion points for each type of test.
  - Tracking can be done on both browser or the server.

## Bucket Key Counters
Use these to create a counter for almost anything.

  - Page views by name, category, path
  - Screen resolution
  - OSes
  - Browser JavaScript errors
  - Whatever else you can think of.
  - Rendering times client or server

## Stats
  - The library returns stats for all tests as JSON
  - Easy to plug into existing dashboard frameworks
  - Formattable time offsets (defaults to UTC)
  - Filterable by start and end time (UTC)

## Browser Integration
  You can copy and paste, or use the middleware, to expose a brower API for tracking client interactions.

  Provides hooks for:

  - Variant Event Tracking
  - Bucket Tracking
  - Data Tracking

## Middleware
   - Easy to configure and works great with Express/Connect
   - Leverage your existing domain without having to setup and administer a separate subdomain

## Raindance Server/Dashboard
Say goodbye to droughts! Chats, graphs, and all that.

  - A standalone server for administering and charting tests.
  - Can also be used as the server for module testing, event/bucket tracking and servering the browser api.

Coming soon!

## Bot Filtering
To avoid having bots influence the outcome of your tests, you'll want to filter them.
The settings allow you to define the RegExp patterns to filter on.
By default, this is an empty list, so be sure and set this up.
