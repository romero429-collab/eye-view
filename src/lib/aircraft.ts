import { AIRCRAFT_TYPES } from "./aircraft-types.ts";
import { wakeOf } from "./wake.ts";

/** ICAO Doc 8643 designators, via the Mictronics type table.
 *  Each row is [description, class, wake]. Class is like L2J: landplane, 2 jets. */

const TABLE = AIRCRAFT_TYPES;

const MAKERS = [
  "AIRBUS HELICOPTERS",
  "DE HAVILLAND",
  "MCDONNELL DOUGLAS",
  "BRITISH AEROSPACE",
  "AGUSTA WESTLAND",
  "AIR TRACTOR",
  "EUROCOPTER",
  "PILATUS BRITTEN",
];

const VEHICLE: Record<string, string> = {
  L: "Landplane",
  S: "Seaplane",
  A: "Amphibian",
  H: "Helicopter",
  G: "Gyrocopter",
  T: "Tiltrotor",
};

const ENGINE: Record<string, string> = {
  P: "piston",
  T: "turboprop",
  J: "jet",
  E: "electric",
  R: "rocket",
};

export type AircraftIdentity = {
  make: string;
  model: string;
  vehicle: string;
  engines: string;
  wake: string;
  wtc: string;
  mass: string;
  spacing: string;
  code: string;
};

function titleMake(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function prettyModel(value: string): string {
  return value
    .split(" ")
    .map((word) => (/\d/.test(word) ? word : word ? word[0] + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function splitDescription(description: string): { make: string; model: string } {
  const upper = description.toUpperCase();
  for (const maker of MAKERS) {
    if (upper.startsWith(`${maker} `)) {
      return { make: titleMake(maker), model: prettyModel(description.slice(maker.length).trim()) };
    }
  }
  const [make, ...rest] = description.split(" ");
  return { make: titleMake(make ?? description), model: prettyModel(rest.join(" ")) || description };
}

export function aircraftIdentity(code: unknown): AircraftIdentity | null {
  const key = String(code ?? "").toUpperCase().replace(/\s/g, "");
  if (!key || key === "NULL") return null;
  const row = TABLE[key];
  if (!row) {
    return {
      make: "Type",
      model: key,
      vehicle: "Aircraft",
      engines: "Unknown",
      wake: "Unknown",
      wtc: "M",
      mass: "Not in the type book",
      spacing: "Wake spacing unknown",
      code: key,
    };
  }
  const [description, klass, wakeLetter] = row;
  const named = splitDescription(description);
  const vehicle = VEHICLE[klass[0] ?? ""] ?? "Aircraft";
  const count = Number(klass[1]);
  const engine = ENGINE[klass[2] ?? ""] ?? "";
  const engines = Number.isFinite(count) && engine ? `${count} ${engine}${count === 1 ? "" : "s"}` : klass || "Unknown";
  const wake = wakeOf(key, wakeLetter);
  return {
    make: named.make,
    model: named.model || key,
    vehicle,
    engines,
    wake: wake.name,
    wtc: wake.code,
    mass: wake.mass,
    spacing: wake.spacing,
    code: key,
  };
}
