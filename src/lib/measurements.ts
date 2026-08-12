// Jedinstvena definicija mera klijenta (Aleksandrov komentar #1 — 12 mera).
// Koristi je i profil klijenta i forma za novog klijenta, da se ključevi poklapaju
// (npr. "bokovi", ne stari "kuk"/"rame"). Čuva se kao Record<string,string> u
// customer_measurements.data (jsonb) — nema promene šeme.
//
// type:
//   num   = jedna brojna vrednost (cm)
//   range = opseg "od-do" (npr. 98-102), unosi se kao tekst
//   text  = specifična mera (aksla/satla) — bez fiksne jedinice
export type MeasurementType = "num" | "range" | "text";

export interface MeasurementField {
  key: string;
  label: string;
  type: MeasurementType;
}

export const MEASUREMENT_FIELDS: MeasurementField[] = [
  { key: "vrat", label: "Vrat", type: "num" },
  { key: "grudi", label: "Grudi", type: "range" },
  { key: "struk", label: "Struk", type: "range" },
  { key: "stomak", label: "Stomak", type: "range" },
  { key: "bokovi", label: "Bokovi", type: "range" },
  { key: "duzina", label: "Dužina", type: "num" },
  { key: "rukav", label: "Rukav", type: "num" },
  { key: "aksla", label: "Aksla", type: "text" },
  { key: "satla", label: "Satla", type: "text" },
  { key: "biceps", label: "Biceps", type: "range" },
  { key: "podlaktica", label: "Podlaktica", type: "range" },
  { key: "zglob", label: "Zglob", type: "num" },
];

export function emptyMeasurements(): Record<string, string> {
  return Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, ""]));
}
