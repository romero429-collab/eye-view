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
| Plants | GBIF Plantae density + Tracheophyta / Poaceae occurrences; OSM wood/grass/farmland/wetland | Green heat. Click a cell → named tree, shrub, or crop. Vegetation is structural data. |
| Domestic | GBIF cattle density + livestock taxa | Sand heat. |
| Quakes | USGS 2.5+ last 24h | Magnitude-colored rings on a seismic heat field. |

A tap never flies to a previously selected country. The inspector names the
**layer** (Wild, Quakes, Zoning) and the **ground** country only as context.

## OpenStreetMap stack

Tiles: [OpenFreeMap planet](https://openfreemap.org/) in the OpenMapTiles
schema. See [spatial-stack.md](spatial-stack.md) for GiST vs tile index, and
which OMT layers we paint.

Ask the map to assemble a view (`transit in industrial`, `terrain for animals here`).
Zoning then coordinates the other feeds. Ground walk uses OpenFreeMap building
extrusions at neighborhood zoom.
