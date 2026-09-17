# GIS sources — parcels, zoning, OSM, heat

Kiyoshi's Eye View keeps satellite as the persistent base. Plots, Zoning, and
heat overlays are independent. There is **no single free worldwide legal-zoning
or assessor-parcel API**.

## Plots (lot lines + site address)

| Coverage | Source | How we use it |
| --- | --- | --- |
| United States | [Regrid Nationwide Parcel Boundaries](https://www.regrid.com/) Esri tiles | Raster lot lines at neighborhood zoom. Tiles-only (no identify). |
| Worldwide | OpenStreetMap buildings + housenumbers via [OpenFreeMap](https://openfreemap.org/) | Vector footprints and house numbers. |
| Worldwide | OSM Overpass `boundary=cadastral\|lot`, `place=plot`, vacant landuse | Extra lot polygons when tagged. |
| Worldwide | [Nominatim](https://nominatim.org/) reverse | Click → site address, or **No site address** on vacant lots. |

## Zoning (land use + landcover)

| Coverage | Source | How we use it |
| --- | --- | --- |
| Worldwide | OSM `landuse` via OpenFreeMap (`residential`, `commercial`, `industrial`, `retail`, civic, military) | Color fill from city scale. |
| Worldwide | OSM `landcover` (`wood`, `grass`, `farmland`, wetland, sand, ice) + `park` | Rural / green fill so zoning is not an empty urban-only wash. |
| Sparse | OSM `zoning=*` / `zone:type=*` Overpass | Legal zone codes where mappers tagged them (rare). |
| City blocks | OSM `landuse=residential|commercial|industrial|retail` Overpass | Named district polygons at neighborhood zoom, indexed like a GiST pass in the browser. |

Country metric choropleth **fades out** once zoning or a heat layer is on, and
always by zoom 8. Zone colors no longer mix with GDP green.

## Heat maps (density, not countries)

| Overlay | Source | Readout |
| --- | --- | --- |
| Wild | GBIF hex density (Mammalia) + occurrence search (mammals + birds) | Amber → dense heat. Click a cell → “Wildlife density”, then the nearest named species. |
| Plants | **GIS stack, not labels:** NASA GIBS MODIS NDVI, GBIF Plantae density + Tracheophyta/Poaceae occurrences, iNaturalist Plantae observations, OSM trees/woods/orchards/gardens/protected areas (Overpass), OSM hydro (`water`) | Green heat + named plants. Vegetation is structural data. Click a cell or a tree. |
| Domestic | GBIF cattle density + livestock taxa | Sand heat. |
| Quakes | USGS 2.5+ last 24h | Magnitude-colored rings on a seismic heat field. |

A tap never flies to a previously selected country. The inspector names the
**layer** (Wild, Quakes, Zoning) and the **ground** country only as context.

## Every public GIS feed this HUD can actually reach

No worldwide cadastral or legal-zoning API exists. These are the feeds that
answer without an API key and are wired into perception:

| Domain | Source | Overlay |
| --- | --- | --- |
| Imagery | NASA GIBS Blue Marble + Esri World Imagery | Base |
| Greenness | NASA GIBS MODIS Terra NDVI 8-day | Plants |
| Elevation | USGS 3DEP EPQS (US point height) + Mapzen/Nextzen terrarium DEM (hills in walk) | Ground, walk |
| Lidar | USGS 3DEP LPC inventory (workunit, QL, GSD) + Entwine EPT metadata. NASA GEDI L3 RH100 canopy-height tiles (spaceborne). Raw LAS/LAZ is not streamed — billions of points. | Ground |
| Geology | Macrostrat map units (lithology + age) | Ground |
| Soil | ISRIC SoilGrids sand/clay/silt 0–5 cm | Ground |
| Ditches / hydro | OSM waterway (ditch, drain, stream, canal) + OpenMapTiles water | Ground, Plants |
| Occurrences | GBIF density + occurrence search with vernacular, family, IUCN, photo. Wildlife = mammals, birds, amphibians, squamates (GBIF files reptiles under Squamata, not class Reptilia). | Wild, Plants, Domestic, Bugs |
| Citizen science | iNaturalist Plantae observations | Plants |
| Land cover | OSM OpenMapTiles landuse / landcover / park / water | Zoning, Plants |
| Trees / woods | OSM Overpass trees/woods/orchards; fill-extrusion canopy + stems in walk | Plants |
| Atmosphere | AviationWeather METAR, Open-Meteo, Open-Meteo Air Quality | IoT |
| Seismic | USGS earthquakes | Quakes |
| Weather raster | RainViewer | Radar |
| Hazards | NASA EONET, NWS alerts | Events, Alerts |
| Movement | GTFS-RT, ADS-B, Amtrak/VIA | Transit, Flights, Rail |
| Lots / buildings | Regrid US parcels, OSM building extrusions, Nominatim | Plots, walk |
| Trails | Waymarked Trails hiking / riding | Hiking, Domestic |

## USGS elevation

There is no free worldwide 3DEP XYZ terrain-RGB. What we can actually drape:

- **USGS 3DEP EPQS** — a JSON height at the look-at (meters). Wired into IoT and Ground.
- **Mapzen/Nextzen terrarium DEM** — RGB-encoded tiles MapLibre can inflate. Walk mode leaves the globe, sits on this DEM, and exaggerates relief so ditches and mesas read as ground, not a texture.

## Lidar (point clouds vs canopy)

Coverage is **Earth**, not a US demo:

| Where | Source | Accuracy |
| --- | --- | --- |
| Global land | NASA GEDI L3 RH100 tiles | Spaceborne lidar canopy (~1 km wash) |
| Global land | ICESat-2 OpenAltimetry tracks at the look-at | Photon lidar ground tracks |
| Global, including poles and ocean | Open-Meteo DEM + Mapzen terrarium | Height in meters; walk hills |
| CONUS where a workunit exists | USGS 3DEP LPC + EPT | Meter-class airborne; inventoried, not streamed |

Ask `lidar here` in Tokyo or Manaus — you still get ICESat-2 tracks, GEDI canopy, and a height. The HUD never teleports the walk to Albuquerque.

## NDVI (greenness)

NDVI is `(near-infrared − red) / (near-infrared + red)`. Live canopy reflects NIR strongly, so dense plants read bright/green on the NASA MODIS 8-day composite; pavement, water, and bare rock read dark. It is a **structure metric**, not a pretty tint. Click the plants heat or ask `what's growing here`.

Ask `what rocks are here`, `what bugs are here`, `what's growing here`, or `walk this street`. Walk stands buildings, forest canopy, and individual tree stems up on the DEM.

## OpenStreetMap stack

Tiles: [OpenFreeMap planet](https://openfreemap.org/) in the OpenMapTiles
schema. See [spatial-stack.md](spatial-stack.md) for GiST vs tile index, and
which OMT layers we paint.

Ask the map to assemble a view (`transit in industrial`, `terrain for animals here`).
Zoning then coordinates the other feeds. Ground walk uses OpenFreeMap building
extrusions at neighborhood zoom.
