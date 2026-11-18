# Job location maps — item 25

Job and direct-proposal forms use a lazy-loaded Leaflet 1.9.4 map with standard
OpenStreetMap raster tiles. No key or new environment variable is required.

Customers can click/tap to place a pin, drag it, choose Use my current location,
or remove it. The map starts over western Gambia without selecting a location.
It never requests GPS on page load. A manual move or removal invalidates any
pending GPS callback. Keyboard users can focus the map, pan with arrow keys and
press Enter or Space to place the pin at its centre. Zoom controls remain available;
wheel zoom is disabled to keep normal form scrolling predictable.

The form state, API payloads and database format remain
`{ type: "Point", coordinates: [longitude, latitude] }`. Leaflet's latitude/longitude
order is converted only at the map boundary, without rounding stored values.
Existing locations load their pin on edit. Optional location removal still sends
the existing null/omitted payload for the corresponding form.
The job editor also keeps its selected service controlled while the catalog loads,
so saving a location edit preserves the existing service instead of resetting it.

Booking details show a read-only map only when an exact point is already available.
Customer owners retain their existing access. Workers see maps only for CONFIRMED,
IN_PROGRESS, WORKER_MARKED_COMPLETED, COMPLETED or DISPUTED bookings, matching the
existing backend serializer. Pending proposals, opportunities and unpaid bookings
do not gain exact coordinates or worker maps. No backend serializers, roles or
location permissions were extended. The external View job location link opens OSM.
Worker base and discovery controls keep their existing GPS-only behaviour.

Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, visible OSM attribution,
native browser caching and an origin-only cross-origin Referer. There is no tile
proxy, bulk download, offline tile cache, geocoding endpoint or extra API credential.
If tiles fail, pin selection and GPS remain available and the form can still be saved;
the UI reports the unavailable background. Map tiles require an internet connection.

References: [Leaflet stable API](https://leafletjs.com/reference-1.9.4.html),
[OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

Checks cover real Leaflet click/keyboard/drag interactions, GPS opt-in, coordinate
order and persistence, edit hydration, tile failure, mobile layout, and the worker
API/map boundary before and after mock payment. Browser tests use an isolated local
replica set and do not touch the application's Atlas data.
