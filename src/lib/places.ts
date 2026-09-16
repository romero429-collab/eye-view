import { COUNTRIES } from "@/lib/countries";
import { scaleTier } from "@/lib/scale";

export type PlaceKind = "country" | "state" | "county" | "city" | "plot";

export type PlotType =
  | "residential"
  | "commercial"
  | "industrial"
  | "agricultural"
  | "civic"
  | "mixed"
  | "conservation";

export type Place = {
  id: string;
  kind: PlaceKind;
  name: string;
  parentId: string | null;
  countryId: string;
  lat: number;
  lon: number;
  aliases: string[];
  plotType?: PlotType;
  population?: number;
};

export const KIND_LABEL: Record<PlaceKind, string> = {
  country: "Country",
  state: "State / region",
  county: "County",
  city: "City / town",
  plot: "Land plot",
};

export const PLOT_LABEL: Record<PlotType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  civic: "Civic",
  mixed: "Mixed use",
  conservation: "Conservation",
};

export const PLOT_FILL: Record<PlotType, string> = {
  residential: "var(--color-choropleth-3)",
  commercial: "var(--color-choropleth-5)",
  industrial: "var(--color-nodata)",
  agricultural: "var(--color-choropleth-4)",
  civic: "var(--color-primary)",
  mixed: "var(--color-choropleth-2)",
  conservation: "var(--color-choropleth-6)",
};

const PLOT_TYPES: PlotType[] = [
  "residential",
  "residential",
  "residential",
  "mixed",
  "commercial",
  "civic",
  "industrial",
  "agricultural",
  "conservation",
];

type Row = [
  PlaceKind,
  string,
  string,
  string | null,
  string,
  number,
  number,
  string,
  PlotType | "",
  number,
];

const ROWS: Row[] = [
  ["state", "us-al", "Alabama", "840", "840", 32.81, -86.79, "AL", "", 0],
  ["state", "us-ak", "Alaska", "840", "840", 64.2, -153.37, "AK", "", 0],
  ["state", "us-az", "Arizona", "840", "840", 34.05, -111.09, "AZ", "", 0],
  ["state", "us-ar", "Arkansas", "840", "840", 34.97, -92.37, "AR", "", 0],
  ["state", "us-ca", "California", "840", "840", 36.78, -119.42, "CA,Calif", "", 0],
  ["state", "us-co", "Colorado", "840", "840", 39.06, -105.31, "CO", "", 0],
  ["state", "us-ct", "Connecticut", "840", "840", 41.6, -72.76, "CT", "", 0],
  ["state", "us-de", "Delaware", "840", "840", 38.91, -75.53, "DE", "", 0],
  ["state", "us-dc", "District of Columbia", "840", "840", 38.91, -77.04, "DC,Washington DC", "", 0],
  ["state", "us-fl", "Florida", "840", "840", 27.66, -81.52, "FL", "", 0],
  ["state", "us-ga", "Georgia", "840", "840", 32.17, -82.9, "GA", "", 0],
  ["state", "us-hi", "Hawaii", "840", "840", 19.9, -155.58, "HI", "", 0],
  ["state", "us-id", "Idaho", "840", "840", 44.07, -114.74, "ID", "", 0],
  ["state", "us-il", "Illinois", "840", "840", 40.35, -88.99, "IL", "", 0],
  ["state", "us-in", "Indiana", "840", "840", 39.85, -86.26, "IN", "", 0],
  ["state", "us-ia", "Iowa", "840", "840", 42.01, -93.21, "IA", "", 0],
  ["state", "us-ks", "Kansas", "840", "840", 38.53, -96.73, "KS", "", 0],
  ["state", "us-ky", "Kentucky", "840", "840", 37.67, -84.67, "KY", "", 0],
  ["state", "us-la", "Louisiana", "840", "840", 31.17, -91.87, "LA", "", 0],
  ["state", "us-me", "Maine", "840", "840", 45.25, -69.23, "ME", "", 0],
  ["state", "us-md", "Maryland", "840", "840", 39.06, -76.8, "MD", "", 0],
  ["state", "us-ma", "Massachusetts", "840", "840", 42.23, -71.53, "MA,Mass", "", 0],
  ["state", "us-mi", "Michigan", "840", "840", 44.31, -85.6, "MI", "", 0],
  ["state", "us-mn", "Minnesota", "840", "840", 46.28, -94.31, "MN", "", 0],
  ["state", "us-ms", "Mississippi", "840", "840", 32.74, -89.68, "MS", "", 0],
  ["state", "us-mo", "Missouri", "840", "840", 38.46, -92.29, "MO", "", 0],
  ["state", "us-mt", "Montana", "840", "840", 46.88, -110.45, "MT", "", 0],
  ["state", "us-ne", "Nebraska", "840", "840", 41.49, -99.9, "NE", "", 0],
  ["state", "us-nv", "Nevada", "840", "840", 38.8, -116.42, "NV", "", 0],
  ["state", "us-nh", "New Hampshire", "840", "840", 43.45, -71.57, "NH", "", 0],
  ["state", "us-nj", "New Jersey", "840", "840", 40.06, -74.41, "NJ", "", 0],
  ["state", "us-nm", "New Mexico", "840", "840", 34.52, -105.87, "NM", "", 0],
  ["state", "us-ny", "New York", "840", "840", 43.0, -75.5, "NY", "", 0],
  ["state", "us-nc", "North Carolina", "840", "840", 35.63, -79.81, "NC", "", 0],
  ["state", "us-nd", "North Dakota", "840", "840", 47.55, -101.0, "ND", "", 0],
  ["state", "us-oh", "Ohio", "840", "840", 40.39, -82.76, "OH", "", 0],
  ["state", "us-ok", "Oklahoma", "840", "840", 35.57, -96.93, "OK", "", 0],
  ["state", "us-or", "Oregon", "840", "840", 43.8, -120.55, "OR", "", 0],
  ["state", "us-pa", "Pennsylvania", "840", "840", 41.2, -77.19, "PA", "", 0],
  ["state", "us-ri", "Rhode Island", "840", "840", 41.68, -71.51, "RI", "", 0],
  ["state", "us-sc", "South Carolina", "840", "840", 33.86, -80.95, "SC", "", 0],
  ["state", "us-sd", "South Dakota", "840", "840", 43.97, -99.9, "SD", "", 0],
  ["state", "us-tn", "Tennessee", "840", "840", 35.75, -86.69, "TN", "", 0],
  ["state", "us-tx", "Texas", "840", "840", 31.97, -99.9, "TX", "", 0],
  ["state", "us-ut", "Utah", "840", "840", 39.32, -111.09, "UT", "", 0],
  ["state", "us-vt", "Vermont", "840", "840", 44.06, -72.67, "VT", "", 0],
  ["state", "us-va", "Virginia", "840", "840", 37.43, -78.66, "VA", "", 0],
  ["state", "us-wa", "Washington", "840", "840", 47.4, -120.49, "WA", "", 0],
  ["state", "us-wv", "West Virginia", "840", "840", 38.6, -80.45, "WV", "", 0],
  ["state", "us-wi", "Wisconsin", "840", "840", 44.27, -89.62, "WI", "", 0],
  ["state", "us-wy", "Wyoming", "840", "840", 43.08, -107.29, "WY", "", 0],
  ["state", "ca-on", "Ontario", "124", "124", 50.0, -85.0, "ON", "", 0],
  ["state", "ca-qc", "Quebec", "124", "124", 52.0, -72.0, "QC,Québec", "", 0],
  ["state", "ca-bc", "British Columbia", "124", "124", 53.73, -127.65, "BC", "", 0],
  ["state", "ca-ab", "Alberta", "124", "124", 55.0, -115.0, "AB", "", 0],
  ["state", "ca-mb", "Manitoba", "124", "124", 55.0, -97.0, "MB", "", 0],
  ["state", "ca-sk", "Saskatchewan", "124", "124", 54.0, -106.0, "SK", "", 0],
  ["state", "ca-ns", "Nova Scotia", "124", "124", 45.0, -63.0, "NS", "", 0],
  ["state", "mx-cmx", "Mexico City", "484", "484", 19.43, -99.13, "CDMX,DF", "", 0],
  ["state", "mx-jal", "Jalisco", "484", "484", 20.66, -103.35, "", "", 0],
  ["state", "mx-nle", "Nuevo León", "484", "484", 25.68, -100.32, "Nuevo Leon", "", 0],
  ["state", "au-nsw", "New South Wales", "036", "036", -32.0, 147.0, "NSW", "", 0],
  ["state", "au-vic", "Victoria", "036", "036", -37.0, 145.0, "VIC", "", 0],
  ["state", "au-qld", "Queensland", "036", "036", -22.0, 144.0, "QLD", "", 0],
  ["state", "au-wa", "Western Australia", "036", "036", -26.0, 122.0, "WA", "", 0],
  ["state", "gb-eng", "England", "826", "826", 52.36, -1.17, "", "", 0],
  ["state", "gb-sct", "Scotland", "826", "826", 56.49, -4.2, "", "", 0],
  ["state", "gb-wls", "Wales", "826", "826", 52.13, -3.78, "Cymru", "", 0],
  ["state", "gb-nir", "Northern Ireland", "826", "826", 54.6, -6.69, "", "", 0],
  ["state", "de-by", "Bavaria", "276", "276", 48.79, 11.5, "Bayern", "", 0],
  ["state", "de-nw", "North Rhine-Westphalia", "276", "276", 51.43, 7.66, "NRW", "", 0],
  ["state", "de-be", "Berlin", "276", "276", 52.52, 13.4, "", "", 0],
  ["state", "fr-idf", "Île-de-France", "250", "250", 48.85, 2.35, "Ile-de-France", "", 0],
  ["state", "fr-ara", "Auvergne-Rhône-Alpes", "250", "250", 45.76, 4.84, "Auvergne-Rhone-Alpes", "", 0],
  ["state", "jp-13", "Tokyo Metropolis", "392", "392", 35.68, 139.69, "Tokyo-to", "", 0],
  ["state", "jp-27", "Osaka Prefecture", "392", "392", 34.69, 135.5, "", "", 0],
  ["state", "in-mh", "Maharashtra", "356", "356", 19.75, 75.71, "", "", 0],
  ["state", "in-up", "Uttar Pradesh", "356", "356", 26.85, 80.95, "", "", 0],
  ["state", "in-ka", "Karnataka", "356", "356", 15.32, 75.71, "", "", 0],
  ["state", "br-sp", "São Paulo", "076", "076", -23.55, -46.63, "Sao Paulo", "", 0],
  ["state", "br-rj", "Rio de Janeiro", "076", "076", -22.91, -43.17, "", "", 0],
  ["state", "cn-bj", "Beijing Municipality", "156", "156", 39.9, 116.4, "", "", 0],
  ["state", "cn-sh", "Shanghai Municipality", "156", "156", 31.23, 121.47, "", "", 0],
  ["state", "cn-gd", "Guangdong", "156", "156", 23.13, 113.26, "", "", 0],
  ["state", "ng-la", "Lagos State", "566", "566", 6.52, 3.38, "", "", 0],
  ["state", "za-gt", "Gauteng", "710", "710", -26.27, 28.11, "", "", 0],
  ["state", "it-lazio", "Lazio", "380", "380", 41.9, 12.5, "", "", 0],
  ["state", "es-md", "Community of Madrid", "724", "724", 40.42, -3.7, "", "", 0],
  ["state", "kr-11", "Seoul", "410", "410", 37.57, 126.98, "", "", 0],
  ["state", "id-jk", "Jakarta", "360", "360", -6.21, 106.85, "", "", 0],
  ["county", "us-ca-la", "Los Angeles County", "us-ca", "840", 34.05, -118.24, "LA County", "", 10014009],
  ["county", "us-ca-sf", "San Francisco County", "us-ca", "840", 37.77, -122.42, "SF County", "", 873965],
  ["county", "us-ca-scl", "Santa Clara County", "us-ca", "840", 37.35, -121.96, "", "", 1936259],
  ["county", "us-ca-sd", "San Diego County", "us-ca", "840", 32.72, -117.16, "", "", 3298634],
  ["county", "us-ny-ny", "New York County", "us-ny", "840", 40.78, -73.97, "Manhattan", "", 1694263],
  ["county", "us-ny-kings", "Kings County", "us-ny", "840", 40.65, -73.95, "Brooklyn", "", 2736074],
  ["county", "us-ny-queens", "Queens County", "us-ny", "840", 40.73, -73.79, "", "", 2405464],
  ["county", "us-il-cook", "Cook County", "us-il", "840", 41.84, -87.82, "", "", 5275541],
  ["county", "us-tx-harris", "Harris County", "us-tx", "840", 29.79, -95.39, "", "", 4731145],
  ["county", "us-tx-travis", "Travis County", "us-tx", "840", 30.27, -97.74, "", "", 1290188],
  ["county", "us-fl-md", "Miami-Dade County", "us-fl", "840", 25.76, -80.21, "Dade", "", 2701767],
  ["county", "us-az-maricopa", "Maricopa County", "us-az", "840", 33.45, -112.07, "", "", 4420568],
  ["county", "us-wa-king", "King County", "us-wa", "840", 47.55, -122.2, "", "", 2271143],
  ["county", "us-co-denver", "Denver County", "us-co", "840", 39.74, -104.99, "", "", 715522],
  ["county", "us-ma-suffolk", "Suffolk County", "us-ma", "840", 42.36, -71.06, "", "", 797936],
  ["county", "us-ga-fulton", "Fulton County", "us-ga", "840", 33.79, -84.47, "", "", 1066710],
  ["county", "us-pa-phil", "Philadelphia County", "us-pa", "840", 39.95, -75.17, "", "", 1603797],
  ["county", "gb-lnd", "Greater London", "gb-eng", "826", 51.51, -0.13, "London", "", 9002488],
  ["county", "gb-gm", "Greater Manchester", "gb-eng", "826", 53.48, -2.24, "", "", 2867469],
  ["county", "fr-75", "Paris", "fr-idf", "250", 48.86, 2.35, "", "", 2161000],
  ["county", "jp-13113", "Shibuya", "jp-13", "392", 35.66, 139.7, "", "", 230000],
  ["city", "city-nyc", "New York", "us-ny-ny", "840", 40.71, -74.01, "NYC,New York City", "", 8804190],
  ["city", "city-la", "Los Angeles", "us-ca-la", "840", 34.05, -118.24, "LA,L.A.", "", 3898747],
  ["city", "city-chi", "Chicago", "us-il-cook", "840", 41.88, -87.63, "", "", 2746388],
  ["city", "city-hou", "Houston", "us-tx-harris", "840", 29.76, -95.37, "", "", 2304580],
  ["city", "city-phx", "Phoenix", "us-az-maricopa", "840", 33.45, -112.07, "", "", 1608139],
  ["city", "city-phi", "Philadelphia", "us-pa-phil", "840", 39.95, -75.17, "", "", 1603797],
  ["city", "city-sat", "San Antonio", "us-tx", "840", 29.42, -98.49, "", "", 1434625],
  ["city", "city-sd", "San Diego", "us-ca-sd", "840", 32.72, -117.16, "", "", 1386932],
  ["city", "city-dal", "Dallas", "us-tx", "840", 32.78, -96.8, "", "", 1304379],
  ["city", "city-sj", "San Jose", "us-ca-scl", "840", 37.34, -121.89, "San José", "", 1013240],
  ["city", "city-aus", "Austin", "us-tx-travis", "840", 30.27, -97.74, "", "", 974447],
  ["city", "city-jax", "Jacksonville", "us-fl", "840", 30.33, -81.66, "", "", 949611],
  ["city", "city-sf", "San Francisco", "us-ca-sf", "840", 37.77, -122.42, "SF,San Fran", "", 873965],
  ["city", "city-sea", "Seattle", "us-wa-king", "840", 47.61, -122.33, "", "", 749256],
  ["city", "city-den", "Denver", "us-co-denver", "840", 39.74, -104.99, "", "", 715522],
  ["city", "city-bos", "Boston", "us-ma-suffolk", "840", 42.36, -71.06, "", "", 675647],
  ["city", "city-det", "Detroit", "us-mi", "840", 42.33, -83.05, "", "", 639111],
  ["city", "city-atl", "Atlanta", "us-ga-fulton", "840", 33.75, -84.39, "", "", 498715],
  ["city", "city-mia", "Miami", "us-fl-md", "840", 25.76, -80.19, "", "", 442241],
  ["city", "city-minn", "Minneapolis", "us-mn", "840", 44.98, -93.27, "", "", 429954],
  ["city", "city-nola", "New Orleans", "us-la", "840", 29.95, -90.07, "", "", 383997],
  ["city", "city-tor", "Toronto", "ca-on", "124", 43.65, -79.38, "", "", 2794356],
  ["city", "city-van", "Vancouver", "ca-bc", "124", 49.28, -123.12, "", "", 662248],
  ["city", "city-mtl", "Montreal", "ca-qc", "124", 45.5, -73.57, "Montréal", "", 1762949],
  ["city", "city-mex", "Mexico City", "mx-cmx", "484", 19.43, -99.13, "Ciudad de México,CDMX", "", 9209944],
  ["city", "city-gdl", "Guadalajara", "mx-jal", "484", 20.67, -103.35, "", "", 1385621],
  ["city", "city-lon", "London", "gb-lnd", "826", 51.51, -0.13, "", "", 9002488],
  ["city", "city-man", "Manchester", "gb-gm", "826", 53.48, -2.24, "", "", 547627],
  ["city", "city-edi", "Edinburgh", "gb-sct", "826", 55.95, -3.19, "", "", 506520],
  ["city", "city-par", "Paris", "fr-75", "250", 48.86, 2.35, "", "", 2161000],
  ["city", "city-lyon", "Lyon", "fr-ara", "250", 45.76, 4.84, "", "", 522969],
  ["city", "city-ber", "Berlin", "de-be", "276", 52.52, 13.4, "", "", 3677472],
  ["city", "city-muc", "Munich", "de-by", "276", 48.14, 11.58, "München,Munchen", "", 1488202],
  ["city", "city-tyo", "Tokyo", "jp-13", "392", 35.68, 139.69, "", "", 13942856],
  ["city", "city-osa", "Osaka", "jp-27", "392", 34.69, 135.5, "", "", 2753862],
  ["city", "city-sel", "Seoul", "kr-11", "410", 37.57, 126.98, "", "", 9668465],
  ["city", "city-pek", "Beijing", "cn-bj", "156", 39.9, 116.4, "Peking", "", 21542000],
  ["city", "city-sha", "Shanghai", "cn-sh", "156", 31.23, 121.47, "", "", 24870895],
  ["city", "city-can", "Guangzhou", "cn-gd", "156", 23.13, 113.26, "Canton", "", 18676605],
  ["city", "city-del", "Delhi", "in-up", "356", 28.61, 77.21, "New Delhi", "", 16787941],
  ["city", "city-mum", "Mumbai", "in-mh", "356", 19.08, 72.88, "Bombay", "", 12478447],
  ["city", "city-blr", "Bengaluru", "in-ka", "356", 12.97, 77.59, "Bangalore", "", 8443675],
  ["city", "city-sao", "São Paulo", "br-sp", "076", -23.55, -46.63, "Sao Paulo", "", 12325232],
  ["city", "city-rio", "Rio de Janeiro", "br-rj", "076", -22.91, -43.17, "Rio", "", 6747815],
  ["city", "city-bue", "Buenos Aires", "032", "032", -34.6, -58.38, "", "", 3075646],
  ["city", "city-lim", "Lima", "604", "604", -12.05, -77.04, "", "", 9674755],
  ["city", "city-bog", "Bogotá", "170", "170", 4.71, -74.07, "Bogota", "", 7412566],
  ["city", "city-syd", "Sydney", "au-nsw", "036", -33.87, 151.21, "", "", 5312163],
  ["city", "city-mel", "Melbourne", "au-vic", "036", -37.81, 144.96, "", "", 5078193],
  ["city", "city-akl", "Auckland", "554", "554", -36.85, 174.76, "", "", 1657000],
  ["city", "city-jkt", "Jakarta", "id-jk", "360", -6.21, 106.85, "", "", 10562088],
  ["city", "city-mnl", "Manila", "608", "608", 14.6, 120.98, "", "", 1846513],
  ["city", "city-bkk", "Bangkok", "764", "764", 13.76, 100.5, "", "", 8305218],
  ["city", "city-sgn", "Ho Chi Minh City", "704", "704", 10.82, 106.63, "Saigon", "", 8993082],
  ["city", "city-sgp", "Singapore", "702", "702", 1.35, 103.82, "", "", 5637000],
  ["city", "city-hkg", "Hong Kong", "344", "344", 22.32, 114.17, "", "", 7491609],
  ["city", "city-tpe", "Taipei", "158", "158", 25.03, 121.57, "", "", 2602418],
  ["city", "city-ist", "Istanbul", "792", "792", 41.01, 28.98, "", "", 15840900],
  ["city", "city-cai", "Cairo", "818", "818", 30.04, 31.24, "", "", 9539673],
  ["city", "city-lag", "Lagos", "ng-la", "566", 6.52, 3.38, "", "", 14862000],
  ["city", "city-nbo", "Nairobi", "404", "404", -1.29, 36.82, "", "", 4397073],
  ["city", "city-jnb", "Johannesburg", "za-gt", "710", -26.2, 28.05, "Jo'burg", "", 5635127],
  ["city", "city-cpt", "Cape Town", "710", "710", -33.92, 18.42, "", "", 4618000],
  ["city", "city-dxb", "Dubai", "784", "784", 25.2, 55.27, "", "", 3331420],
  ["city", "city-ruh", "Riyadh", "682", "682", 24.71, 46.68, "", "", 7676654],
  ["city", "city-tlv", "Tel Aviv", "376", "376", 32.09, 34.78, "", "", 460613],
  ["city", "city-mos", "Moscow", "643", "643", 55.76, 37.62, "", "", 13010112],
  ["city", "city-waw", "Warsaw", "616", "616", 52.23, 21.01, "", "", 1790658],
  ["city", "city-mad", "Madrid", "es-md", "724", 40.42, -3.7, "", "", 3223334],
  ["city", "city-bcn", "Barcelona", "724", "724", 41.39, 2.17, "", "", 1620343],
  ["city", "city-rom", "Rome", "it-lazio", "380", 41.9, 12.5, "Roma", "", 2873000],
  ["city", "city-mil", "Milan", "380", "380", 45.46, 9.19, "Milano", "", 1371498],
  ["city", "city-ams", "Amsterdam", "528", "528", 52.37, 4.89, "", "", 921402],
  ["city", "city-sto", "Stockholm", "752", "752", 59.33, 18.07, "", "", 984748],
  ["city", "city-osl", "Oslo", "578", "578", 59.91, 10.75, "", "", 709037],
  ["city", "city-cph", "Copenhagen", "208", "208", 55.68, 12.57, "", "", 660842],
  ["city", "city-vie", "Vienna", "040", "040", 48.21, 16.37, "Wien", "", 1962779],
  ["city", "city-zur", "Zurich", "756", "756", 47.38, 8.54, "Zürich,Zurich", "", 434008],
  ["plot", "plot-manhattan", "Manhattan", "city-nyc", "840", 40.78, -73.97, "Midtown", "mixed", 1694263],
  ["plot", "plot-soho", "SoHo", "city-nyc", "840", 40.72, -74.0, "", "commercial", 0],
  ["plot", "plot-brooklyn", "Brooklyn Heights", "us-ny-kings", "840", 40.7, -73.99, "", "residential", 0],
  ["plot", "plot-mission", "Mission District", "city-sf", "840", 37.76, -122.42, "", "mixed", 0],
  ["plot", "plot-dtla", "Downtown Los Angeles", "city-la", "840", 34.05, -118.25, "DTLA", "commercial", 0],
  ["plot", "plot-hollywood", "Hollywood", "city-la", "840", 34.09, -118.33, "", "mixed", 0],
  ["plot", "plot-loop", "Chicago Loop", "city-chi", "840", 41.88, -87.63, "", "commercial", 0],
  ["plot", "plot-city-london", "City of London", "city-lon", "826", 51.52, -0.09, "The Square Mile", "commercial", 0],
  ["plot", "plot-westminster", "Westminster", "city-lon", "826", 51.5, -0.13, "", "civic", 0],
  ["plot", "plot-shoreditch", "Shoreditch", "city-lon", "826", 51.52, -0.08, "", "mixed", 0],
  ["plot", "plot-defense", "La Défense", "city-par", "250", 48.89, 2.24, "La Defense", "commercial", 0],
  ["plot", "plot-marais", "Le Marais", "city-par", "250", 48.86, 2.36, "", "residential", 0],
  ["plot", "plot-shibuya", "Shibuya Crossing", "city-tyo", "392", 35.66, 139.7, "Shibuya", "commercial", 0],
  ["plot", "plot-ginza", "Ginza", "city-tyo", "392", 35.67, 139.77, "", "commercial", 0],
  ["plot", "plot-bund", "The Bund", "city-sha", "156", 31.24, 121.49, "", "mixed", 0],
  ["plot", "plot-lapa", "Lapa", "city-rio", "076", -22.91, -43.18, "", "mixed", 0],
  ["plot", "plot-copacabana", "Copacabana", "city-rio", "076", -22.97, -43.18, "", "residential", 0],
  ["plot", "plot-marina", "Marina Bay", "city-sgp", "702", 1.28, 103.86, "", "mixed", 0],
  ["plot", "plot-downtown-dxb", "Downtown Dubai", "city-dxb", "784", 25.2, 55.27, "", "commercial", 0],
  ["plot", "plot-sandton", "Sandton", "city-jnb", "710", -26.11, 28.06, "", "commercial", 0],
  ["plot", "plot-central-hk", "Central", "city-hkg", "344", 22.28, 114.16, "", "commercial", 0],
  ["plot", "plot-greenbelt-dc", "National Mall", "us-dc", "840", 38.89, -77.03, "", "civic", 0],
  ["plot", "plot-central-park", "Central Park", "city-nyc", "840", 40.78, -73.97, "", "conservation", 0],
  ["plot", "plot-hyde", "Hyde Park", "city-lon", "826", 51.51, -0.16, "", "conservation", 0],
  ["plot", "plot-napa", "Napa Valley", "us-ca", "840", 38.5, -122.3, "", "agricultural", 0],
  ["plot", "plot-rotterdam-port", "Port of Rotterdam", "city-ams", "528", 51.95, 4.14, "", "industrial", 0],
];

function rowToPlace(row: Row): Place {
  const [kind, id, name, parentId, countryId, lat, lon, aliasRaw, plotType, population] =
    row;
  return {
    id,
    kind,
    name,
    parentId,
    countryId,
    lat,
    lon,
    aliases: aliasRaw ? aliasRaw.split(",").filter(Boolean) : [],
    plotType: plotType || undefined,
    population: population || undefined,
  };
}

const countryPlaces: Place[] = COUNTRIES.map((c) => ({
  id: c.id,
  kind: "country" as const,
  name: c.name,
  parentId: null,
  countryId: c.id,
  lat: 0,
  lon: 0,
  aliases: [c.iso3, c.capital].filter(Boolean),
}));

export const PLACES: Place[] = [...countryPlaces, ...ROWS.map(rowToPlace)];

const byId = new Map(PLACES.map((p) => [p.id, p]));

const extras = new Map<string, Place>();

export function rememberPlace(place: Place) {
  extras.set(place.id, place);
}

export function getPlace(id: string | null | undefined): Place | undefined {
  if (!id) return undefined;
  return extras.get(id) ?? byId.get(id);
}

export function placePath(place: Place): Place[] {
  const out: Place[] = [];
  let cur: Place | undefined = place;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out.reverse();
}

export function childrenOf(id: string, kind?: PlaceKind): Place[] {
  return PLACES.filter(
    (p) => p.parentId === id && (kind == null || p.kind === kind),
  );
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const KIND_RANK: Record<PlaceKind, number> = {
  country: 0,
  state: 1,
  county: 2,
  city: 3,
  plot: 4,
};

function kindBoost(kind: PlaceKind, tier: PlaceKind): number {
  const delta = Math.abs(KIND_RANK[kind] - KIND_RANK[tier]);
  if (delta === 0) return 28;
  if (delta === 1) return 12;
  if (delta === 2) return 4;
  return 0;
}

export type PlaceSearchHit = Place & { score: number };

export function searchPlaces(
  query: string,
  opts: {
    tier?: PlaceKind;
    kind?: PlaceKind | "all";
    limit?: number;
    origin?: { lat: number; lon: number };
  } = {},
): PlaceSearchHit[] {
  const q = fold(query.trim());
  if (q.length < 1) return [];
  const tier = opts.tier ?? "country";
  const kind = opts.kind ?? "all";
  const limit = opts.limit ?? 12;
  const typeHit = (Object.keys(PLOT_LABEL) as PlotType[]).find(
    (t) => fold(t) === q || fold(PLOT_LABEL[t]).startsWith(q),
  );

  const hits: PlaceSearchHit[] = [];
  for (const place of PLACES) {
    if (kind !== "all" && place.kind !== kind) continue;
    if (place.kind === "country" && place.lat === 0 && place.lon === 0) {
      /* searchable; fly uses boundaries */
    }
    const name = fold(place.name);
    const alias = place.aliases.map(fold);
    let score = 0;
    if (name === q) score = 120;
    else if (name.startsWith(q)) score = 92;
    else if (name.includes(q)) score = 58;
    else if (alias.some((a) => a === q)) score = 88;
    else if (alias.some((a) => a.startsWith(q))) score = 70;
    else if (alias.some((a) => a.includes(q))) score = 44;
    else if (place.plotType && fold(PLOT_LABEL[place.plotType]).includes(q))
      score = 50;
    if (score === 0) continue;
    score += kindBoost(place.kind, tier);
    if (place.population) score += Math.min(8, Math.log10(place.population));
    if (opts.origin && (place.lat !== 0 || place.lon !== 0)) {
      const d =
        Math.abs(place.lat - opts.origin.lat) +
        Math.abs(place.lon - opts.origin.lon);
      score += Math.max(0, 10 - d / 8);
    }
    hits.push({ ...place, score });
  }

  if (typeHit && (tier === "plot" || kind === "plot" || q.length >= 4)) {
    const origin = opts.origin ?? { lat: 34.05, lon: -118.24 };
    for (const parcel of parcelsNear(origin.lat, origin.lon, 18)) {
      if (parcel.plotType !== typeHit) continue;
      hits.push({ ...parcel, score: 80 });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const unique: PlaceSearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function placesForTier(
  tier: PlaceKind,
  origin: { lat: number; lon: number },
  selected?: Place,
): Place[] {
  const span =
    tier === "plot"
      ? 1.2
      : tier === "city"
        ? 6
        : tier === "county"
          ? 10
          : tier === "state"
            ? 28
            : 50;
  const kinds: PlaceKind[] =
    tier === "plot"
      ? ["plot", "city"]
      : tier === "city"
        ? ["city", "county"]
        : tier === "county"
          ? ["county", "state"]
          : tier === "state"
            ? ["state", "city"]
            : ["country"];

  const out: Place[] = [];
  for (const place of PLACES) {
    if (!kinds.includes(place.kind)) continue;
    if (place.kind === "country") continue;
    if (place.lat === 0 && place.lon === 0) continue;
    const d =
      Math.abs(place.lat - origin.lat) + Math.abs(place.lon - origin.lon);
    if (d > span) continue;
    out.push(place);
  }
  if (selected && selected.kind !== "country") {
    if (!out.some((p) => p.id === selected.id)) out.push(selected);
  }
  out.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return out.slice(0, tier === "plot" ? 28 : 22);
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export type Parcel = Place & {
  ring: [number, number][];
};

export function parcelsNear(lat: number, lon: number, count = 20): Parcel[] {
  const out: Parcel[] = [];
  const latScale = 0.012;
  const lonScale = 0.012 / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < count; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const jitterX = (hash(lat + i) - 0.5) * 0.004;
    const jitterY = (hash(lon + i * 3) - 0.5) * 0.004;
    const cx = lon + (col - 2) * lonScale + jitterX;
    const cy = lat + (1.6 - row) * latScale + jitterY;
    const w = lonScale * (0.32 + hash(i + 9) * 0.22);
    const h = latScale * (0.28 + hash(i + 4) * 0.2);
    const type = PLOT_TYPES[Math.floor(hash(i + lat * 10) * PLOT_TYPES.length)]!;
    const ring: [number, number][] = [
      [cx - w, cy - h],
      [cx + w, cy - h],
      [cx + w, cy + h],
      [cx - w, cy + h],
      [cx - w, cy - h],
    ];
    out.push({
      id: `parcel-${lat.toFixed(3)}-${lon.toFixed(3)}-${i}`,
      kind: "plot",
      name: `${PLOT_LABEL[type]} ${String.fromCharCode(65 + col)}${row + 1}`,
      parentId: null,
      countryId: "",
      lat: cy,
      lon: cx,
      aliases: [type],
      plotType: type,
      ring,
    });
  }
  return out;
}

export function scaleTierForPlace(place: Place): PlaceKind {
  return place.kind;
}

export function currentScaleTier(k: number): PlaceKind {
  return scaleTier(k);
}
