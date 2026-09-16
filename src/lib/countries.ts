import {
  type CountryRecord,
  type MetricId,
  countryValue,
} from "./metrics.ts";

// id|iso3|name|region|capital|gdpPerCapita|population|hdi|lifeExpectancy|co2PerCapita|urbanization
// Illustrative 2022–2024 figures compiled for the demo.
const RAW = `
004|AFG|Afghanistan|Asia|Kabul|416|41128771|0.478|64.0|0.28|26.6
008|ALB|Albania|Europe|Tirana|6810|2832439|0.789|76.8|1.73|64.6
012|DZA|Algeria|Africa|Algiers|5260|44903225|0.745|76.3|3.72|75.2
024|AGO|Angola|Africa|Luanda|2300|35588987|0.591|62.6|0.78|68.1
032|ARG|Argentina|Americas|Buenos Aires|13650|46234830|0.849|75.4|3.74|92.3
031|AZE|Azerbaijan|Asia|Baku|7150|10358074|0.760|73.5|3.51|57.6
036|AUS|Australia|Oceania|Canberra|64740|26439111|0.946|83.0|14.99|86.5
040|AUT|Austria|Europe|Vienna|56330|9042528|0.926|81.6|6.86|59.5
044|BHS|Bahamas|Americas|Nassau|34750|409984|0.820|73.2|6.21|83.6
050|BGD|Bangladesh|Asia|Dhaka|2688|171186372|0.670|73.7|0.64|39.7
051|ARM|Armenia|Asia|Yerevan|8280|2777970|0.786|72.4|2.24|63.6
056|BEL|Belgium|Europe|Brussels|54540|11686140|0.942|81.9|7.64|98.1
064|BTN|Bhutan|Asia|Thimphu|3590|782455|0.681|72.0|1.98|43.3
068|BOL|Bolivia|Americas|Sucre|3600|12224110|0.698|64.9|1.76|70.8
070|BIH|Bosnia and Herzegovina|Europe|Sarajevo|7580|3233526|0.779|75.3|6.31|49.8
072|BWA|Botswana|Africa|Gaborone|7740|2630296|0.708|61.1|2.56|72.2
076|BRA|Brazil|Americas|Brasília|10040|215313498|0.760|73.4|2.20|87.8
084|BLZ|Belize|Americas|Belmopan|6980|405272|0.700|73.2|1.62|46.4
090|SLB|Solomon Islands|Oceania|Honiara|2200|724273|0.564|70.7|0.35|25.1
096|BRN|Brunei|Asia|Bandar Seri Begawan|37150|449002|0.823|74.6|21.70|78.9
100|BGR|Bulgaria|Europe|Sofia|13930|6687717|0.799|71.5|6.04|76.4
104|MMR|Myanmar|Asia|Naypyidaw|1140|54179306|0.585|67.3|0.64|31.8
108|BDI|Burundi|Africa|Gitega|259|12889576|0.426|61.7|0.05|14.4
112|BLR|Belarus|Europe|Minsk|7830|9498238|0.808|73.1|5.99|80.3
116|KHM|Cambodia|Asia|Phnom Penh|1870|16767842|0.600|69.9|1.19|25.1
120|CMR|Cameroon|Africa|Yaoundé|1660|27914546|0.587|60.3|0.36|58.7
124|CAN|Canada|Americas|Ottawa|54920|38781291|0.935|82.7|14.20|81.9
140|CAF|Central African Republic|Africa|Bangui|511|5579144|0.387|53.9|0.04|43.1
144|LKA|Sri Lanka|Asia|Sri Jayawardenepura Kotte|3820|22181000|0.780|76.6|0.92|19.0
148|TCD|Chad|Africa|N'Djamena|717|17703176|0.394|52.5|0.06|24.1
152|CHL|Chile|Americas|Santiago|15360|19603733|0.860|78.9|4.59|87.9
156|CHN|China|Asia|Beijing|12720|1412173172|0.788|78.2|7.99|64.6
158|TWN|Taiwan|Asia|Taipei|32720|23885580|0.916|80.9|11.40|79.3
170|COL|Colombia|Americas|Bogotá|6620|51874024|0.758|73.7|1.60|82.4
178|COG|Congo|Africa|Brazzaville|2640|5977593|0.593|63.9|1.22|68.7
180|COD|DR Congo|Africa|Kinshasa|649|99010212|0.481|59.2|0.03|46.8
188|CRI|Costa Rica|Americas|San José|13650|5180829|0.809|77.0|1.59|82.0
191|HRV|Croatia|Europe|Zagreb|18570|3857682|0.878|77.6|4.16|58.0
192|CUB|Cuba|Americas|Havana|9500|11201916|0.764|73.7|2.04|77.4
196|CYP|Cyprus|Europe|Nicosia|34740|1251488|0.896|81.2|5.64|66.8
203|CZE|Czechia|Europe|Prague|29080|10489800|0.895|77.2|8.64|74.4
204|BEN|Benin|Africa|Porto-Novo|1390|13352864|0.504|59.8|0.62|49.5
208|DNK|Denmark|Europe|Copenhagen|67910|5882261|0.952|81.4|5.13|88.4
214|DOM|Dominican Republic|Americas|Santo Domingo|10120|11228821|0.766|72.6|2.38|83.8
218|ECU|Ecuador|Americas|Quito|6630|18001000|0.765|73.7|2.16|64.8
222|SLV|El Salvador|Americas|San Salvador|5340|6336392|0.674|71.1|1.22|75.0
226|GNQ|Equatorial Guinea|Africa|Malabo|7050|1674908|0.596|60.6|7.10|74.1
231|ETH|Ethiopia|Africa|Addis Ababa|1290|123379924|0.492|65.0|0.16|22.7
232|ERI|Eritrea|Africa|Asmara|644|3684032|0.493|66.5|0.15|42.6
233|EST|Estonia|Europe|Tallinn|29820|1322765|0.899|76.7|7.59|69.8
242|FJI|Fiji|Oceania|Suva|5860|929766|0.729|67.3|1.64|58.2
246|FIN|Finland|Europe|Helsinki|53790|5540718|0.942|81.2|6.47|85.7
250|FRA|France|Europe|Paris|44460|64756584|0.910|82.5|4.60|81.5
262|DJI|Djibouti|Africa|Djibouti|3350|1120849|0.515|62.3|0.48|78.4
266|GAB|Gabon|Africa|Libreville|8820|2388992|0.693|65.7|2.80|90.7
268|GEO|Georgia|Asia|Tbilisi|6670|3714000|0.814|71.7|2.84|60.0
270|GMB|Gambia|Africa|Banjul|844|2705992|0.569|62.1|0.24|63.9
275|PSE|Palestine|Asia|Ramallah|3780|5371230|0.716|73.4|0.56|77.4
276|DEU|Germany|Europe|Berlin|52720|83294633|0.950|80.5|7.98|77.8
288|GHA|Ghana|Africa|Accra|2360|33475870|0.602|63.8|0.62|58.6
300|GRC|Greece|Europe|Athens|22990|10431277|0.893|80.6|5.41|80.4
304|GRL|Greenland|Americas|Nuuk|54500|56661|0.786|71.3|9.80|87.5
320|GTM|Guatemala|Americas|Guatemala City|5470|17915568|0.629|69.2|1.07|52.7
324|GIN|Guinea|Africa|Conakry|1540|13859341|0.471|59.0|0.31|38.1
328|GUY|Guyana|Americas|Georgetown|20650|808726|0.742|65.7|4.12|26.8
332|HTI|Haiti|Americas|Port-au-Prince|1690|11584996|0.552|63.2|0.29|59.3
340|HND|Honduras|Americas|Tegucigalpa|3040|10432860|0.624|70.1|1.08|59.2
348|HUN|Hungary|Europe|Budapest|19360|9676135|0.851|74.5|4.64|72.6
352|ISL|Iceland|Europe|Reykjavík|78490|375318|0.959|82.6|9.31|94.0
356|IND|India|Asia|New Delhi|2410|1428627663|0.644|72.0|1.89|36.4
360|IDN|Indonesia|Asia|Jakarta|4890|275501339|0.713|67.6|2.29|57.9
364|IRN|Iran|Asia|Tehran|4670|89172767|0.780|73.9|8.27|77.3
368|IRQ|Iraq|Asia|Baghdad|5930|44496122|0.673|70.4|4.04|71.4
372|IRL|Ireland|Europe|Dublin|103180|5056935|0.950|82.1|6.77|64.2
376|ISR|Israel|Asia|Jerusalem|54660|9174520|0.915|82.3|6.26|92.8
380|ITA|Italy|Europe|Rome|39000|58870762|0.906|82.9|5.41|71.9
384|CIV|Côte d'Ivoire|Africa|Yamoussoukro|2600|28160542|0.550|58.9|0.41|52.7
388|JAM|Jamaica|Americas|Kingston|6040|2825544|0.706|70.5|2.58|57.4
392|JPN|Japan|Asia|Tokyo|33820|123294513|0.920|84.0|8.50|91.9
398|KAZ|Kazakhstan|Asia|Astana|13140|19606633|0.802|69.4|14.22|58.2
400|JOR|Jordan|Asia|Amman|4410|11337052|0.736|74.3|2.18|91.8
404|KEN|Kenya|Africa|Nairobi|2099|54027487|0.601|61.4|0.36|29.0
408|PRK|North Korea|Asia|Pyongyang|1300|26069416|null|73.3|1.87|62.9
410|KOR|South Korea|Asia|Seoul|35500|51784059|0.929|82.7|11.60|81.5
414|KWT|Kuwait|Asia|Kuwait City|41080|4310108|0.847|78.3|21.60|100.0
417|KGZ|Kyrgyzstan|Asia|Bishkek|1970|6735347|0.701|70.0|1.48|36.9
418|LAO|Laos|Asia|Vientiane|2080|7521061|0.620|68.1|2.79|38.3
422|LBN|Lebanon|Asia|Beirut|4130|5490000|0.723|75.0|3.67|89.4
426|LSO|Lesotho|Africa|Maseru|1060|2305825|0.521|53.0|1.12|29.5
428|LVA|Latvia|Europe|Riga|22500|1830211|0.879|73.3|3.54|68.5
430|LBR|Liberia|Africa|Monrovia|755|5302681|0.487|61.0|0.24|53.1
434|LBY|Libya|Africa|Tripoli|6710|6812341|0.746|71.9|8.95|81.0
440|LTU|Lithuania|Europe|Vilnius|27100|2718352|0.879|73.7|4.14|68.5
442|LUX|Luxembourg|Europe|Luxembourg|128320|654768|0.927|81.5|12.46|91.7
450|MDG|Madagascar|Africa|Antananarivo|505|29611714|0.501|64.5|0.13|39.9
454|MWI|Malawi|Africa|Lilongwe|645|20405317|0.508|62.9|0.08|17.7
458|MYS|Malaysia|Asia|Kuala Lumpur|11990|33938221|0.807|74.9|8.56|78.2
466|MLI|Mali|Africa|Bamako|897|22593590|0.410|58.9|0.17|45.0
478|MRT|Mauritania|Africa|Nouakchott|2140|4736139|0.540|64.4|0.89|57.7
484|MEX|Mexico|Americas|Mexico City|11490|127504125|0.781|70.2|3.70|81.3
496|MNG|Mongolia|Asia|Ulaanbaatar|5040|3398366|0.741|71.0|11.20|68.9
498|MDA|Moldova|Europe|Chișinău|6650|2511102|0.763|71.2|3.31|43.2
499|MNE|Montenegro|Europe|Podgorica|12240|616166|0.844|76.3|3.67|68.5
504|MAR|Morocco|Africa|Rabat|3670|37457971|0.698|74.0|1.85|65.1
508|MOZ|Mozambique|Africa|Maputo|608|32969518|0.461|59.5|0.22|38.2
512|OMN|Oman|Asia|Muscat|23290|4576298|0.819|72.5|15.30|87.8
516|NAM|Namibia|Africa|Windhoek|5030|2567012|0.610|59.3|1.54|58.0
524|NPL|Nepal|Asia|Kathmandu|1399|30589640|0.601|68.4|0.59|21.4
528|NLD|Netherlands|Europe|Amsterdam|62740|17618200|0.946|81.7|7.13|92.9
540|NCL|New Caledonia|Oceania|Nouméa|35740|271030|0.789|77.7|18.90|72.0
548|VUT|Vanuatu|Oceania|Port Vila|3360|326740|0.607|70.4|0.58|25.7
554|NZL|New Zealand|Oceania|Wellington|48830|5223100|0.939|82.5|6.45|86.9
558|NIC|Nicaragua|Americas|Managua|2360|6948392|0.669|73.8|0.79|59.6
562|NER|Niger|Africa|Niamey|590|26207977|0.400|62.1|0.10|16.9
566|NGA|Nigeria|Africa|Abuja|2020|218541212|0.548|53.6|0.61|54.3
578|NOR|Norway|Europe|Oslo|87960|5457127|0.966|83.2|7.51|83.7
586|PAK|Pakistan|Asia|Islamabad|1568|235824862|0.540|66.4|0.85|37.7
591|PAN|Panama|Americas|Panama City|17370|4408581|0.820|76.4|2.66|69.5
598|PNG|Papua New Guinea|Oceania|Port Moresby|3020|10142625|0.568|65.4|0.82|13.5
600|PRY|Paraguay|Americas|Asunción|6150|6780744|0.731|70.3|1.22|62.8
604|PER|Peru|Americas|Lima|7120|33726000|0.762|72.4|1.79|78.7
608|PHL|Philippines|Asia|Manila|3940|115559009|0.710|69.3|1.30|48.0
616|POL|Poland|Europe|Warsaw|19900|41026067|0.881|76.5|7.66|60.1
620|PRT|Portugal|Europe|Lisbon|27330|10247605|0.874|81.6|3.93|67.4
624|GNB|Guinea-Bissau|Africa|Bissau|776|2105566|0.483|59.9|0.16|45.0
626|TLS|Timor-Leste|Asia|Dili|1720|1341296|0.566|67.7|0.44|32.1
630|PRI|Puerto Rico|Americas|San Juan|36620|3260314|0.845|79.1|2.30|93.6
634|QAT|Qatar|Asia|Doha|81970|2695122|0.875|79.3|32.40|99.3
642|ROU|Romania|Europe|Bucharest|15890|19659204|0.827|74.2|3.74|54.6
643|RUS|Russia|Europe|Moscow|13800|144444359|0.821|69.4|10.81|75.1
646|RWA|Rwanda|Africa|Kigali|966|13776680|0.548|66.1|0.11|17.6
682|SAU|Saudi Arabia|Asia|Riyadh|32340|36408878|0.875|77.0|18.20|84.8
686|SEN|Senegal|Africa|Dakar|1740|17316439|0.511|67.1|0.63|49.1
688|SRB|Serbia|Europe|Belgrade|11360|6664449|0.805|74.2|6.27|56.9
694|SLE|Sierra Leone|Africa|Freetown|527|8605718|0.458|60.1|0.13|43.8
703|SVK|Slovakia|Europe|Bratislava|23320|5428792|0.855|74.9|5.86|53.8
704|VNM|Vietnam|Asia|Hanoi|4340|98858950|0.726|73.6|3.50|39.0
705|SVN|Slovenia|Europe|Ljubljana|32160|2119672|0.926|80.9|6.16|55.8
706|SOM|Somalia|Africa|Mogadishu|592|17597511|0.380|55.3|0.04|46.8
710|ZAF|South Africa|Africa|Pretoria|6770|59893885|0.717|61.5|6.95|68.8
716|ZWE|Zimbabwe|Africa|Harare|2150|16320537|0.550|59.4|0.70|32.4
724|ESP|Spain|Europe|Madrid|32680|47519628|0.911|83.2|5.11|81.3
728|SSD|South Sudan|Africa|Juba|455|10913164|0.381|55.0|0.15|20.5
729|SDN|Sudan|Africa|Khartoum|1102|46874204|0.516|65.6|0.48|35.6
740|SUR|Suriname|Americas|Paramaribo|5360|618040|0.690|70.3|4.10|66.4
748|SWZ|Eswatini|Africa|Mbabane|3980|1201671|0.610|57.1|0.96|24.6
752|SWE|Sweden|Europe|Stockholm|56370|10415811|0.952|83.1|3.60|88.5
756|CHE|Switzerland|Europe|Bern|93260|8773637|0.967|83.9|4.02|74.2
760|SYR|Syria|Asia|Damascus|537|22125206|0.557|72.1|1.37|56.8
762|TJK|Tajikistan|Asia|Dushanbe|1210|9952787|0.679|71.3|1.00|27.7
764|THA|Thailand|Asia|Bangkok|7180|71697030|0.803|76.4|3.71|52.9
768|TGO|Togo|Africa|Lomé|1010|8848699|0.539|61.6|0.29|43.9
780|TTO|Trinidad and Tobago|Americas|Port of Spain|18330|1531044|0.814|73.0|22.40|53.3
784|ARE|United Arab Emirates|Asia|Abu Dhabi|53770|9441129|0.937|78.7|21.80|87.5
788|TUN|Tunisia|Africa|Tunis|3900|12356117|0.732|73.8|2.59|70.1
792|TUR|Turkey|Asia|Ankara|12980|85325965|0.855|76.0|5.11|77.0
795|TKM|Turkmenistan|Asia|Ashgabat|8080|6430770|0.744|69.4|11.80|53.0
800|UGA|Uganda|Africa|Kampala|1070|47249585|0.550|62.7|0.13|26.2
804|UKR|Ukraine|Europe|Kyiv|5070|36744634|0.734|71.8|3.96|70.1
807|MKD|North Macedonia|Europe|Skopje|7610|2093599|0.765|73.8|3.62|58.5
818|EGY|Egypt|Africa|Cairo|4290|110990103|0.728|70.2|2.23|43.0
826|GBR|United Kingdom|Europe|London|48890|66971411|0.940|80.7|4.85|84.4
834|TZA|Tanzania|Africa|Dodoma|1220|65497748|0.549|66.2|0.23|36.7
840|USA|United States|Americas|Washington, D.C.|81630|333287557|0.927|77.4|14.44|83.3
854|BFA|Burkina Faso|Africa|Ouagadougou|874|22673762|0.449|59.8|0.17|32.5
858|URY|Uruguay|Americas|Montevideo|20790|3423108|0.830|75.4|1.96|95.8
860|UZB|Uzbekistan|Asia|Tashkent|2490|35648100|0.727|70.9|3.48|50.5
862|VEN|Venezuela|Americas|Caracas|3470|28301696|0.699|70.9|3.71|88.3
887|YEM|Yemen|Asia|Sana'a|677|33696614|0.424|63.7|0.32|39.2
894|ZMB|Zambia|Africa|Lusaka|1330|20017675|0.569|61.2|0.40|45.8
Kosovo|XKX|Kosovo|Europe|Pristina|5940|1786038|0.762|77.0|4.90|50.0
`.trim();

function parseNullable(raw: string): number | null {
  if (raw === "null" || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseRow(line: string): CountryRecord {
  const [
    id,
    iso3,
    name,
    region,
    capital,
    gdpPerCapita,
    population,
    hdi,
    lifeExpectancy,
    co2PerCapita,
    urbanization,
  ] = line.split("|");
  return {
    id: id!,
    iso3: iso3!,
    name: name!,
    region: region!,
    capital: capital!,
    gdpPerCapita: parseNullable(gdpPerCapita!),
    population: parseNullable(population!),
    hdi: parseNullable(hdi!),
    lifeExpectancy: parseNullable(lifeExpectancy!),
    co2PerCapita: parseNullable(co2PerCapita!),
    urbanization: parseNullable(urbanization!),
  };
}

export const COUNTRIES: CountryRecord[] = RAW.split("\n").map(parseRow);

const byId = new Map(COUNTRIES.map((c) => [c.id, c]));
const byName = new Map(COUNTRIES.map((c) => [c.name, c]));

const ATLAS_NAME_ALIASES: Record<string, string> = {
  "United States of America": "840",
  "Dem. Rep. Congo": "180",
  "Dominican Rep.": "214",
  "Central African Rep.": "140",
  "Eq. Guinea": "226",
  "Solomon Is.": "090",
  "Bosnia and Herz.": "070",
  Macedonia: "807",
  "S. Sudan": "728",
  eSwatini: "748",
  "Côte d'Ivoire": "384",
};

export function lookupCountry(feature: {
  id?: string | number;
  properties?: { name?: string };
}): CountryRecord | undefined {
  if (feature.id != null) {
    const hit = byId.get(String(feature.id));
    if (hit) return hit;
  }
  const atlasName = feature.properties?.name;
  if (!atlasName) return undefined;
  const aliased = ATLAS_NAME_ALIASES[atlasName];
  if (aliased) return byId.get(aliased);
  return byId.get(atlasName) ?? byName.get(atlasName);
}

export function countriesWithMetric(metric: MetricId): CountryRecord[] {
  return COUNTRIES.filter((c) => countryValue(c, metric) != null);
}

export function rankedCountries(metric: MetricId): CountryRecord[] {
  return [...countriesWithMetric(metric)].sort((a, b) => {
    const av = countryValue(a, metric) ?? 0;
    const bv = countryValue(b, metric) ?? 0;
    return bv - av;
  });
}

export function countryRank(
  country: CountryRecord,
  metric: MetricId,
): { rank: number; total: number } | null {
  const value = countryValue(country, metric);
  if (value == null) return null;
  const ranked = rankedCountries(metric);
  const rank = ranked.findIndex((c) => c.id === country.id) + 1;
  return { rank, total: ranked.length };
}

export function metricExtent(metric: MetricId): { min: number; max: number; median: number } | null {
  const values = countriesWithMetric(metric)
    .map((c) => countryValue(c, metric)!)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!;
  return { min: values[0]!, max: values[values.length - 1]!, median };
}
