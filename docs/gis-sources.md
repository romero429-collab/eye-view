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
| Occurrences | GBIF density + occurrence search | Wild, Plants, Domestic |
| Citizen science | iNaturalist Plantae observations | Plants |
| Land cover | OSM OpenMapTiles landuse / landcover / park / water | Zoning, Plants |
| Trees / woods | OSM Overpass `natural=tree/wood`, forest, orchard, vineyard, garden, protected_area | Plants |
| Elevation | USGS 3DEP EPQS (US) | IoT look-at node |
| Atmosphere | AviationWeather METAR, Open-Meteo, Open-Meteo Air Quality (US AQI / PM2.5) | IoT |
| Seismic | USGS earthquakes | Quakes |
| Weather raster | RainViewer | Radar |
| Hazards | NASA EONET, NWS alerts | Events, Alerts |
| Movement | GTFS-RT, ADS-B, Amtrak/VIA | Transit, Flights, Rail |
| Lots | Regrid US parcels, OSM buildings, Nominatim | Plots |
| Trails | Waymarked Trails hiking / riding | Hiking, Domestic |

Ask `what's growing here` to assemble the plant GIS. Zoning then coordinates:
wildlife clusters on cover, transit avoids sensitive vegetation, a commercial
polygon full of native plants proposes a reclass.

## OpenStreetMap stack

Tiles: [OpenFreeMap planet](https://openfreemap.org/) in the OpenMapTiles
schema. See [spatial-stack.md](spatial-stack.md) for GiST vs tile index, and
which OMT layers we paint.

Ask the map to assemble a view (`transit in industrial`, `terrain for animals here`).
Zoning then coordinates the other feeds. Ground walk uses OpenFreeMap building
extrusions at neighborhood zoom.
