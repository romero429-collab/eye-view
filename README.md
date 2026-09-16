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

- `transit in industrial` — assembles transit + streets + zoning, then drops to city scale
- `terrain for animals here` — wildlife + trails + zoning at the look-at
- `walk this street` — drops to ground level with 3D buildings
- `recreation here` — recreation districts (stadiums, pitches, parks)

From orbit, district queries fly into Albuquerque so land-use tiles actually load. Zoning is the coordinating container: wildlife avoids industrial, extractive, and seismic; transit snaps to streets; radar dims the other live dots.

## Overlays

Satellite stays on. Queries assemble a set; chips still override.

- **Plots** — US lot lines (Regrid) plus OSM buildings / house numbers worldwide. Click a parcel for the site address, or **No site address** when the lot is vacant.
- **Zoning** — OSM land-use *and* landcover: residential, commercial, industrial, retail, civic, recreation, construction, quarry/landfill, park/wood, farmland, pasture. Legal municipal codes are still sparse.
- **Wild / Quakes** — heat maps. Amber wildlife density is GBIF hexes (animals), not a plane and not a country. Click a cell to inspect that layer. The inspector shows a **reality frame**: look-at coordinates, zone, and country as ground context.
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
