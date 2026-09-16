# Kiyoshi's Eye View

Live satellite globe for the AirSync / Kiyoshi stack. Persistent imagery base,
independent overlays, click-to-inspect, no accounts.

This HUD is Kiyoshi's **reality-grounding layer** — look-at, zone, live events,
walkable ground. The continuity engine lives in
[Kiyoshi-AI-OS](https://github.com/romero429-collab/Kiyoshi-AI-OS). How the two
fit: [docs/kiyoshi.md](docs/kiyoshi.md).

**Public repo:** [romero429-collab/eye-view](https://github.com/romero429-collab/eye-view)

Also copied (private) into:

- [`romero429-collab/airsync`](https://github.com/romero429-collab/airsync) → `eye-view/`
- [`romero429-collab/main`](https://github.com/romero429-collab/main) → `projects/airsync/eye-view`

## Ask the map

Type what you want instead of hunting toggles. Chips under the bar run the same recipes, and they reorder toward what you have been inspecting.

- `how does transit move here` — vehicles perceive the district. Flood reroutes; a learned reclass can orphan a paper route.
- `terrain for animals here` — wildlife + trails + zoning at the look-at
- `walk this street` — drops to ground level with 3D buildings
- `this is residential` — teaches the look-at; a local patch overrides OSM
- `what's changing here` — IoT sensors + IOM. Weather, seismic, and ground tags reroute transit and update the frame.
- `split this zone` — subdivides the district under the crosshair

Walk the street to **Tag / Reclass / Split / Merge**. The block underfoot commits immediately; four adjacent blocks queue as proposals — they stay independent until you confirm. Live wildlife, plants, transit, and events propose reclassifications the same way.

From orbit, district queries fly into Albuquerque so land-use tiles actually load. Zoning is the coordinating container: wildlife avoids industrial, extractive, and seismic; plants fight paved commercial; transit snaps to streets; radar dims the other live dots.

## Overlays

Satellite stays on. Queries assemble a set; chips still override.

- **Plots** — US lot lines (Regrid) plus OSM buildings / house numbers worldwide. Click a parcel for the site address, or **No site address** when the lot is vacant.
- **Zoning** — OSM land-use *and* landcover: residential, commercial, industrial, retail, civic, recreation, construction, quarry/landfill, park/wood, farmland, pasture. Legal municipal codes are still sparse.
- **Wild / Plants / Quakes** — heat maps. Amber is animals, green is vegetation, not a country. Click a cell for a named occurrence. The inspector shows a **reality frame**: look-at coordinates, zone, and country as ground context.
- **Rail, Domestic, Health, Transit, Flights, Radar, Alerts, Events**

## Ground walk

Footprints control, or ask `walk here`. WASD: W forward, S back, A turns left, D turns right. Esc or Stand returns to the globe.

GIS source notes: [docs/gis-sources.md](docs/gis-sources.md). Zoning engines, PostGIS indexing, OSM: [docs/spatial-stack.md](docs/spatial-stack.md). Kiyoshi contract: [docs/kiyoshi.md](docs/kiyoshi.md).

## Run

```bash
npm install
npm run dev
```

TanStack Start + MapLibre GL JS 6 globe. Auth and database are off.
