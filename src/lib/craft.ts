/** ADS-B emitter category and type designator → a silhouette. */

const HELI = /^(R22|R44|R66|EC20|EC30|EC35|EC45|EC55|EC75|EC135|EC145|H60|H47|UH60|UH1H|UH1|B06|B407|B412|B212|B222|B429|B430|AS32|AS35|AS50|AS55|AS65|S76|S92|A109|A119|A139|MI8|MI17|GAZL|ALO2|ALO3)/;

export function craftKind(category: unknown, typeCode: unknown): "heli" | "plane" {
  if (String(category ?? "").toUpperCase() === "A7") return "heli";
  const code = String(typeCode ?? "").toUpperCase().replace(/\s/g, "");
  if (HELI.test(code)) return "heli";
  return "plane";
}
