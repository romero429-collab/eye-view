# Zoning rule engines, PostGIS indexing, and OSM

Eye View is a globe HUD, not a cadastral GIS of record. This note is the
investigation behind the query bar, the zoning coordinator, heat maps, and
ground walk.

## Zoning rule engines

Municipal zoning is a **rule table over polygons**: district → use, bulk, setback,
parking. Engines that already do this:

| Engine | What it does | Fit for this HUD |
| --- | --- | --- |
| [Open Zoning](https://www.openzoning.ai/product) OZFS | District intersection → code translation → spatial build envelope | Best open spec for *legal* US zoning. Per-municipality feeds, not a globe API. |
| [zoning.space](https://github.com/zoningspace/zoning.space) | Machine-readable height / FAR / setback / parking | Comparative research dataset. |
| EuclidHL (Houseal Lavigne) | LLM + GIS answers ordinance questions | Pattern for “ask the map”, licensed stack. |
| Esri ArcGIS Urban / CityEngine | CGA rules, 3D envelopes | Closed; too heavy for a satellite HUD. |
| OpenRules / gvSIG PSS | Land-use allocation heuristics | Planning support, not live overlay coordination. |

**What we shipped:** a client-side **coordinator**, not a legal ordinance parser.
OSM `landuse` + `landcover` (OpenFreeMap / OpenMapTiles) is the worldwide
container. Rules are typed effects — container, avoid, snap, dim, prefer —
evaluated at the look-at from rendered vector tiles.

Legal `zoning=*` tags still appear only where OSM has them. OZFS / municipal
shapefiles remain the path for true FAR/setback when a city feed exists.

## PostGIS spatial indexing

When AirSync grows a district warehouse, PostGIS is the system of record.
A spatial query is two phases:

1. **Index filter (cheap, approximate).** A GiST (Generalized Search Tree)
   stores each geometry’s minimum bounding rectangle in an R-tree. Operators
   like `&&` walk the tree and collect candidates whose boxes overlap.
2. **Exact test (expensive, few rows).** `ST_Intersects`, `ST_Contains`,
   `ST_DWithin` run only on the survivors.

```sql
CREATE INDEX parcels_gix ON parcels USING GIST (geom);
CREATE INDEX zones_gix   ON zones   USING GIST (geom);

SELECT p.id, z.class
FROM parcels p
JOIN zones z ON p.geom && z.geom AND ST_Intersects(p.geom, z.geom)
WHERE z.class = 'industrial';
```

| Access method | Structure | Use |
| --- | --- | --- |
| **GiST** (`gist_geometry_ops_2d`) | R-tree of MBRs | Default. Polygons, lines, mixed overlays. Best when shapes overlap (parcels, districts). |
| **SP-GiST** | Quad-tree / kd-tree | Non-overlapping points (GBIF occurrences, ADS-B). Faster inserts, worse when boxes overlap. |
| **BRIN** | Block-range MBR | Huge, append-only, spatially clustered tables (tile-loaded OSM extracts). Tiny index, only if rows are physically ordered. |
| **B-tree** | Ordered keys | `iso`, `taxon_key`, `mag` — never the geometry column. |

Pitfalls PostGIS docs keep repeating:

- `ST_Distance(a,b) < d` cannot use the index. Use `ST_DWithin(a,b,d)`.
- Geography vs geometry: GiST on `geography` is spheroidal; mix SRID and the
  planner will seq-scan.
- `CLUSTER parcels USING parcels_gix` is a one-time physical reorder.

**What the HUD uses now:** vector tiles are already a spatial index. MapLibre
`queryRenderedFeatures` is the tile-local `&&`. The country pick does the
exact test in the browser (`src/lib/spatial-index.ts`): bbox reject, then
`geoContains` — the same two-phase pattern, so a tap in Albuquerque cannot
select Luxembourg.

## OpenStreetMap data (OpenMapTiles / OpenFreeMap)

OpenFreeMap serves the [OpenMapTiles schema](https://openmaptiles.org/schema/).
Layers this HUD actually paints:

| OMT layer | OSM tags | HUD overlay |
| --- | --- | --- |
| `landuse` | `landuse=*`, `amenity=*`, `leisure=pitch/stadium` | Zoning (urban classes) |
| `landcover` | `natural=wood`, `landuse=farmland/grass`, wetland, sand, ice | Zoning (cover) |
| `park` | `leisure=park/garden` | Zoning (park fill) |
| `building` | `building=*`, height / levels | Plots + walk extrusions |
| `housenumber` | `addr:housenumber` | Plots |
| `transportation` `class=rail\|transit` | `railway=*` | Rail |
| `poi` railway | stations | Rail |
| `place` | labels (via Esri reference tiles, not OMT text) | Labels |

What OSM does **not** give us globally: legal zoning ordinances, assessor
parcels, or a single cadastral API. Regrid covers US lots. `zoning=*` is
sparse Overpass. At neighborhood zoom we also pull OSM `landuse=*` polygons
(residential / commercial / industrial / retail) so the look-at can name a
district even when the legal code is missing.

**Altitude gate:** OpenMapTiles `landuse` is empty above ~zoom 6–8 (~40 km).
The coordinator does not pretend a district contains the view from orbit —
it asks you to drop in (Albuquerque is the demo city). Queries that mention
zones, transit, or walk call `dropToDistricts()` so the tile index has
features to return.

Heat maps sit **on top of** zoning, they do not blend with the country
choropleth. At city zoom the metric fill fades to zero so zone color and
wildlife heat stay distinct. Country pick is suppressed once zoning, wildlife,
or another ground overlay is on — a tap on a GBIF hex is animals, not GDP.

## Spatial databases (when, not now)

| Store | Role | Here |
| --- | --- | --- |
| **PostGIS** | Operational system of record. Transactions, GiST, pgRouting, pg_tileserv. | Future AirSync backend. Not in this HUD: no accounts, Vercel has no writable spatial cluster. |
| **DuckDB spatial** | Local / lakehouse analytics on GeoParquet. | Offline batch. |
| **SpatiaLite** | Embedded file DB. | Phone/offline kits. |
| **MapLibre + OpenFreeMap** | Tile-backed spatial index in the browser. | **What the HUD uses now.** |

Client helpers: `src/lib/spatial.ts` (haversine, destination),
`src/lib/spatial-index.ts` (GiST analogue), `src/lib/heat.ts` (ramps + zone
swatches including recreation / construction / extractive / pasture),
`src/lib/zoning-rules.ts` (coordinator), `src/lib/map-query.ts` (ask the map),
`src/lib/perception.ts` (Kiyoshi reality frame), `src/lib/attention.ts`
(inspect → salience). How this HUD sits in the OS: [kiyoshi.md](kiyoshi.md).
