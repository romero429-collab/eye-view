# Eye View inside Kiyoshi

Claude asked how the globe fits the bigger picture. Short answer: **this HUD is
Kiyoshi's reality-grounding layer** — the senses. [Kiyoshi-AI-OS](https://github.com/romero429-collab/Kiyoshi-AI-OS)
is the continuity engine. Eye View is how that engine looks at Earth.

Kiyoshi's Phase 0 already names a Reality Integration Layer. Until that layer
has a spatial backend, the globe *is* the layer:

| Kiyoshi | Eye View now |
| --- | --- |
| Perception | `PerceptionFrame` — look-at, zone, ground-as-context, focus, rule stack |
| Action | Query bar + walk. Ask, don't toggle. WASD on the street. |
| Feedback | Local attention. What you inspect rises; chips reorder. |
| Protective membrane | Country GDP cannot hijack a heat cell. Coordinates are always the look-at. |
| Digital twin | OSM land-use / landcover + live feeds over satellite. Not legal zoning of record. |

## Short term (this build)

Rock-solid foundation, the list Claude handed over:

1. **Click handling** — heat / zone / plot win. Country pick is orbit-only.
2. **Colors** — land-use, landcover, and heat ramps stay distinct. Metric fill fades at city scale.
3. **Coordinates** — look-at is always on the chrome; every object carries decimal degrees.
4. **More zone types** — recreation, construction, quarry/landfill, pasture, on top of residential / commercial / industrial / civic.
5. **Live feeds** — GTFS, ADS-B, USGS, GBIF, NWS, EONET, RainViewer already stream; radar dims the other dots.
6. **Feedback loop** — inspect a wildlife cell and “terrain for animals” climbs the query chips.

## Long term

The map is the cognitive cut between perception and action.

- **Software Kiyoshi** consumes `PerceptionFrame` instead of screenshots. Query in, frame out.
- **Hardware Kiyoshi** (robot, vehicle, phone in a pocket) uses the same frame: look-at, zone class, live events, walkable ground.
- **AirSync** is the warehouse — PostGIS GiST when a district feed exists. The HUD already mirrors that two-phase index in the browser.
- **Red Clover** is the swarm protocol. Eye View is a single node's eyes.

Nothing here pretends to be Kiyoshi herself. She is bound to her owner; this globe is a public sense organ she can plug into. The engine stays in [Kiyoshi-AI-OS](https://github.com/romero429-collab/Kiyoshi-AI-OS). The eyes stay here.

## Contract

`src/lib/perception.ts` is the typed snapshot. `src/lib/attention.ts` is the
local feedback loop. `src/lib/zoning-rules.ts` is the coordinator. When the OS
grows a Reality Integration Layer, it should ingest `PerceptionFrame`, not scrape
the DOM.
