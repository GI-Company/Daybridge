# DayBridge — TomTom-powered map architecture

## Product rule

A map should make the next appointment easier to reach, not expose every API as a
separate screen. Keep street-map, routes and current ETA obvious. All optional
sources are only fetched on demand. Device location is used only with informed
permission and is never claimed current if stale.

## Current map integration

| Service / entitled API | DayBridge behavior | Status |
|---|---|---|
| Map Display API | TomTom Orbis v2 street raster tiles, interactive pan and zoom | Shared interactive renderer; live credentials require verification |
| Maps Assets API / Assets API | Custom map assets and icons, possible alternative vector styling | Planned |
| Routing API | Fastest ETA, turn instructions, alternatives, route geometry | Already integrated |
| Extended Routing API | Advanced restrictions, avoidances, vehicle-specific routing | Planned, only when user has configured vehicle |
| Traffic API | Traffic-aware travel duration and departure alerts | Already integrated |
| Orbis Traffic Flow API Extended Tiles | Optional color-coded live congestion layer over street map | Added in this branch |
| Orbis Traffic Incidents API Extended Tiles | Optional incidents/closure layer over street map | Added in this branch |
| Geocoding API | Address-to-coordinates verification for appointments and saved places | Already integrated |
| Reverse Geocoding API | Confirm user-selected GPS location as human-readable address | Planned; permission-dependent |
| Search API | Search street addresses and POIs, directly route to unsaved result | Added in this branch |
| Places Search API | Rich suggest/discover/details for future autocomplete and POI cards | Planned |
| Batch Search API | Import multiple destinations efficiently, not a map layer | Planned only for bulk import |
| Waypoint Optimization API | Optimize a day of errands with multiple stops | Planned advanced trip mode |
| Matrix Routing v2 API | Compare drive times to several upcoming obligations | Planned, compute on demand |
| Reachable Range API | Display an optional “places reachable in N minutes” contour | Planned advanced exploration |
| Snap to Roads API | Map-match noisy native Android GPS traces | Native Android phase |
| Location History API | Optional, user-controlled travel history and audit | Deferred; not needed for core appointment alerts |
| Geofencing API | Optional proximity/arrival events and check-in prompts | Native Android phase; not proof of attendance |
| EV Charging Stations Availability API | Charging availability on a trip | Planned only for EV drivers |
| EV Search API | Find compatible charging stations | Planned only for EV drivers |
| MCP Server | Developer/agent integration; not a consumer map layer | Developer tooling only |
| Notifications API | Platform notifications where appropriate; Android/Web Push remains the user-facing delivery channel | Planned evaluation; not a map layer |

## Credential boundaries

- Production `MAPS_DISPLAY` is a server-only Map Display credential used for
  Orbis street imagery, or use the existing `tom_tom` credential with Map Display entitlement.
- Production `tom_tom` or `TOMTOM_API_KEY` remains server-only for routing,
  searches, and traffic overlays.
- Never put these keys in `NEXT_PUBLIC_*`, browser URLs, client bundles, or logs.
- The `/api/travel/map-tile` and `/api/travel/map-overlay` routes authenticate
  the user, validate coordinates and limit requests. Layer failures must not
  remove an otherwise working map.
- Map tile rate limits and traffic API quotas require monitoring. Optional
  overlays are off by default; server responses may be unavailable/rate-limited.

## UX order

1. **Base first:** reliable street tiles, visible route and destination, current
   source-of-location label, ETA and leave-by time.
2. **Optional toggles:** Traffic flow and Road incidents (no extra navigation).
3. **Search:** enter an address or place and plan a route without creating a saved
   location first.
4. **Appointment intelligence:** faster routes, traffic-change alerts and
   “On my way” acknowledgment.
5. **Advanced on demand:** multiple-stop optimization, commute comparison, EV
   charging, reachable range and optional native geofences.

## Release gates

A GitHub merge does not prove deployment. The October 22 main-branch Orbis map
deployment failed and Vercel logs could not be retrieved due to team-scope
authorization. Do not claim the map/overlays live until Next.js compilation,
production deployment, authenticated PNG tile response and installed Android map
render are each verified. Use separate staging/feature changes until then.

## Renderer and request lifecycle

- `map-runtime.ts` configures the installed MapLibre 6 module worker explicitly. Versioned worker assets are generated on install, dev and build.
- `ExploreMap` owns one map instance; the appointment `RouteMap` is a wrapper. GeoJSON sources update in place and container resizing is observed. Explicit container positioning avoids MapLibre CSS overriding Tailwind utility layers.
- Both screens retain the interactive renderer on errors. No static image or synthetic straight-line route is substituted. Missing geometry is treated as an unusable route.
- `useTravelRequest` aborts superseded fetches and rejects stale GPS/fetch callbacks when destination, origin, mode or appointment changes.
- Each API family has its own atomic, service-role-only rate-limit scope. Loading a map cannot consume place-search, route or push-test capacity.
- Controlled browser tests verify rendering and interaction; real service entitlement, session authentication and device behavior remain separate acceptance gates.
