/** ICAO wake turbulence category. Letter is what goes in the flight plan.
 *  Mass is maximum certificated take-off mass. Spacing is the extra distance
 *  a following aircraft needs when this one is ahead, same altitude or below. */

export type WakeCode = "J" | "H" | "M" | "L";

export type WakeBrief = {
  code: WakeCode;
  name: string;
  mass: string;
  spacing: string;
};

const SUPER = new Set(["A388"]);

export function wakeOf(typeCode: string, tableLetter: string): WakeBrief {
  const code = SUPER.has(typeCode.toUpperCase()) ? "J" : letterOf(tableLetter);
  return brief(code);
}

function letterOf(letter: string): WakeCode {
  const value = letter.toUpperCase();
  if (value === "J" || value === "H" || value === "M" || value === "L") return value;
  return "M";
}

function brief(code: WakeCode): WakeBrief {
  switch (code) {
    case "J":
      return {
        code,
        name: "Super",
        mass: "A380, about 560 t",
        spacing: "Behind it: heavy 5 NM, medium 7 NM, light 8 NM",
      };
    case "H":
      return {
        code,
        name: "Heavy",
        mass: "136 t or more",
        spacing: "Behind it: heavy 4 NM, medium 5 NM, light 6 NM",
      };
    case "L":
      return {
        code,
        name: "Light",
        mass: "7 t or less",
        spacing: "Nothing extra is required behind it",
      };
    default:
      return {
        code,
        name: "Medium",
        mass: "More than 7 t, under 136 t",
        spacing: "A light aircraft behind it needs 5 NM",
      };
  }
}
