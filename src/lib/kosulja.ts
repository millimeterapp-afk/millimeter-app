// Jedinstvena definicija opcija za NALOG ZA KOŠULJU (domaća proizvodnja).
// Izvor: Aleksandrov mejl 24.8.2026. Ovo je "spec" sloj — koriste ga forma i (kasnije)
// server akcija. Bazne mere po veličini + pun engine mera stižu iz Munro dokumenta.

// ── Kragne (14) — SR naziv + EN naziv ─────────────────────────────────────────
export interface KragnaOpcija { sr: string; en: string }
export const KRAGNE: KragnaOpcija[] = [
  { sr: "Klasična", en: "Classic" },
  { sr: "Klasična zaobljena", en: "Rounded classic" },
  { sr: "Polu-zasečena", en: "Semi-cutaway" },
  { sr: "Polu-zasečena mala", en: "Semi-cutaway small" },
  { sr: "Zasečena", en: "Cutaway" },
  { sr: "Široka", en: "Wide spread" },
  { sr: "Ekstremno široka", en: "Extreme wide spread" },
  { sr: "Široka zaobljena", en: "Wide spread round" },
  { sr: "Kent", en: "Kent" },
  { sr: "Kragna sa dugmetom", en: "Button-down" },
  { sr: "Sa dugmetom mala", en: "Button-down small" },
  { sr: "Skriveno dugme", en: "Hidden button-down" },
  { sr: "Tux", en: "Wing" },
  { sr: "Ruska", en: "Mao" },
];

// Uz kragnu se biraju još dve stvari:
// 1) Visina šteja — Standard ili +1cm.
export const STEJ_OPCIJE = ["Standard", "+1cm"] as const;
export type StejOpcija = (typeof STEJ_OPCIJE)[number];

// 2) Špic kragne — Aleksandar: "dužina špica i dodatne opcije stižu detaljno,
//    verovatno duži špic +1cm ili +2cm, ali još nije precizirano". PRIVREMENO
//    (potvrditi sa Aleksandrom + moguće različito po kragni).
export const SPIC_OPCIJE = ["Standard", "Duži +1cm", "Duži +2cm"] as const;
export type SpicOpcija = (typeof SPIC_OPCIJE)[number];

// ── Manžetne (5) ──────────────────────────────────────────────────────────────
export const MANZETNE = ["Zakošena", "Zaobljena", "Ravna", "Dupla", "2 u 1"] as const;
export type Manzetna = (typeof MANZETNE)[number];

// ── Krojevi ───────────────────────────────────────────────────────────────────
// Za sada SAMO Hol slim (= Holandski slim = Munro kroj), veličine 35–46
// (Aleksandar 24.8; NAPOMENA: Nikola je u maju pomenuo 38–45 — nesklad, ide
// Aleksandrov noviji opseg 35–46; potvrditi uz Munro tabelu).
// Kasnije: Olimp (S–XXXL), Naš slim (TBD), Hol reg (TBD).
export const HOL_SLIM_VELICINE = Array.from({ length: 46 - 35 + 1 }, (_, i) => String(35 + i));
export interface KrojDef { id: string; naziv: string; velicine: string[]; aktivan: boolean }
export const KROJEVI: KrojDef[] = [
  { id: "hol_slim", naziv: "Hol slim", velicine: HOL_SLIM_VELICINE, aktivan: true },
  { id: "olimp", naziv: "Olimp", velicine: ["S", "M", "L", "XL", "XXL", "XXXL"], aktivan: false },
  { id: "nas_slim", naziv: "Naš slim", velicine: [], aktivan: false },
  { id: "hol_reg", naziv: "Hol reg", velicine: [], aktivan: false },
];

// ── Mere i korekcije (delte) + OGRANIČENJA ────────────────────────────────────
// Tok: izabereš baznu veličinu → uneseš delte (+2 grudi, −2 biceps…) → sistem
// izbaci konačne mere = bazne + delte. Delta preko limita se BLOKIRA (signal da se
// klijentu da veći bazni broj). `limit: null` = nema ograničenja.
// Bazni brojevi po veličini stižu iz Munro tabele (page 5 legenda, page 7 Hol slim).
export interface MeraLimit { key: string; label: string; limit: number | null }
export const MERE_LIMITI: MeraLimit[] = [
  { key: "grudi", label: "Grudi", limit: 4 },
  { key: "stomak", label: "Stomak", limit: null },
  { key: "bokovi", label: "Bokovi", limit: null },
  { key: "duzina_napred", label: "Dužina napred", limit: null },
  { key: "duzina_nazad", label: "Dužina nazad", limit: null },
  { key: "biceps", label: "Biceps", limit: 3 },
  { key: "podlaktica", label: "Podlaktica", limit: 3 },
  { key: "zglob", label: "Zglob", limit: null },
  { key: "orukavlje", label: "Orukavlje", limit: 2 },
];

// Kombinovano ograničenje: |Δ orukavlje| + |Δ biceps| ≤ 4 (Aleksandar: "Orukavlje i
// biceps +-4"). Tumačenje suma-apsolutnih — POTVRDITI sa Aleksandrom.
export const KOMBINOVANO_LIMIT = { mere: ["orukavlje", "biceps"] as const, limit: 4 };

// Provera jedne delte prema pojedinačnom limitu.
export function deltaVanLimita(key: string, delta: number): boolean {
  const m = MERE_LIMITI.find((x) => x.key === key);
  if (!m || m.limit === null) return false;
  return Math.abs(delta) > m.limit;
}

// ── BAZNE MERE (Munro Long & Short SIZE TABLES, SHIRT / Slim fit = Hol slim) ────
// Izvor: PDF „Size-tables_Long-and-short.pdf", strana 6. Vrednosti su TAČNO kako
// Munro navodi. A/B/C su POLOVINA obima (½) → obim = vrednost ×2. Kolone po slovu:
export interface MunroKolona { letter: string; en: string; sr: string; half: boolean }
export const MUNRO_SHIRT_COLONE: MunroKolona[] = [
  { letter: "A", en: "½ Chest", sr: "Grudi", half: true },
  { letter: "B", en: "½ Waist", sr: "Struk", half: true },
  { letter: "C", en: "½ Hip", sr: "Bokovi", half: true },
  { letter: "D", en: "Shoulder Yoke", sr: "Rame (jaram)", half: false },
  { letter: "E", en: "Back Length", sr: "Dužina leđa (nazad)", half: false },
  { letter: "F", en: "Front Length", sr: "Dužina napred", half: false },
  { letter: "G", en: "Armhole", sr: "Orukavlje", half: false },
  { letter: "H", en: "Upper Arm", sr: "Biceps (nadlaktica)", half: false },
  { letter: "I", en: "Fore Arm", sr: "Podlaktica", half: false },
  { letter: "J", en: "Long Sleeve", sr: "Dugačak rukav", half: false },
  { letter: "K", en: "Short Sleeve", sr: "Kratak rukav", half: false },
  { letter: "L", en: "Cuff", sr: "Manžetna", half: false },
  { letter: "M", en: "Collar", sr: "Kragna", half: false },
];

// Redovi = veličine 35–46; vrednosti u redosledu kolona A..M gore.
export const HOL_SLIM_BAZA: Record<string, number[]> = {
  "35": [48, 48, 48, 42, 76, 67, 39.7, 36.4, 31.5, 63, 23, 23, 35],
  "36": [50, 50, 50, 43, 76, 67, 41.2, 37.6, 31.9, 63, 23, 23, 36],
  "37": [52, 52, 52, 44, 76, 67, 42.7, 38.7, 32.3, 63, 23, 23, 37],
  "38": [54, 54, 54, 45, 76, 67, 44.2, 39.8, 32.8, 63, 23, 23, 38],
  "39": [56, 56, 56, 46, 80, 70, 45.6, 41.4, 34.6, 65, 25, 25, 39],
  "40": [58, 58, 58, 47, 80, 70, 47.1, 42.5, 35.0, 65, 25, 25, 40],
  "41": [60, 60, 60, 48, 80, 70, 48.6, 43.6, 35.4, 65, 25, 25, 41],
  "42": [62, 62, 62, 49, 80, 70, 50.0, 44.7, 35.9, 65, 25, 25, 42],
  "43": [64, 64, 64, 50, 80, 70, 51.5, 45.9, 36.3, 65, 25, 25, 43],
  "44": [66, 66, 66, 51, 80, 70, 53.0, 47.0, 36.7, 65, 25, 25, 44],
  "45": [68, 68, 68, 52, 84, 73, 54.4, 48.5, 38.5, 67, 27, 27, 45],
  "46": [70, 70, 70, 53, 84, 73, 55.9, 49.7, 38.9, 67, 27, 27, 46],
};

// Vraća bazne mere za veličinu kao mapu po slovu, sa obimom (×2 za ½ kolone).
export function baznaMera(velicina: string) {
  const row = HOL_SLIM_BAZA[velicina];
  if (!row) return null;
  return MUNRO_SHIRT_COLONE.map((c, i) => ({
    ...c,
    vrednost: row[i],
    obim: c.half ? row[i] * 2 : row[i], // za grudi/struk/bokovi prikazujemo pun obim
  }));
}
