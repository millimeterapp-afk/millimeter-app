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

// 2) Špic kragne. Aleksandrov komentar (28.8, „Beleske po modulima (3)"): dodati
//    +3 i -1, -2, -3 uz postojeće Standard/+1/+2. "Standard" ostaje prva opcija
//    (podrazumevana), ostale idu od kraćeg ka dužem.
export const SPIC_OPCIJE = [
  "Standard", "Kraći -1cm", "Kraći -2cm", "Kraći -3cm", "Duži +1cm", "Duži +2cm", "Duži +3cm",
] as const;
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

// ── BAZNE MERE (Munro Long & Short SIZE TABLES, SHIRT / Slim fit 2.0 = Hol slim) ─
// Izvor: PDF „Size-tables_Long-and-short.pdf", STRANA 7 (Slim fit 2.0 = Hol slim).
// PAŽNJA: strana 6 je Regular fit (grudi=struk=bokovi), strana 8 Comfort — NE koristiti
// za Hol slim. Vrednosti su TAČNO kako Munro navodi. A/B/C su POLOVINA obima (½) →
// obim = vrednost ×2. Kolone po slovu (M/Collar se isporučuje +1cm zbog skupljanja):
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
  "35": [46, 40, 44, 42, 76, 67, 34.1, 31.0, 29.4, 63, 23, 22, 35],
  "36": [48, 42, 46, 43, 76, 67, 35.5, 32.1, 29.9, 63, 23, 22, 36],
  "37": [50, 44, 48, 44, 76, 67, 37.0, 33.2, 30.3, 63, 23, 22, 37],
  "38": [52, 46, 50, 45, 76, 67, 38.5, 34.4, 30.7, 63, 23, 22, 38],
  "39": [54, 48, 52, 46, 80, 70, 39.9, 35.9, 32.5, 65, 25, 24, 39],
  "40": [56, 50, 54, 47, 80, 70, 41.4, 37.0, 33.0, 65, 25, 24, 40],
  "41": [58, 52, 56, 48, 80, 70, 42.9, 38.1, 33.4, 65, 25, 24, 41],
  "42": [60, 54, 58, 49, 80, 70, 44.3, 39.2, 33.8, 65, 25, 24, 42],
  "43": [62, 56, 60, 50, 80, 70, 45.8, 40.3, 34.3, 65, 25, 24, 43],
  "44": [64, 58, 62, 51, 80, 70, 47.3, 41.4, 34.7, 65, 25, 24, 44],
  "45": [66, 60, 64, 52, 84, 73, 48.7, 43.0, 36.5, 67, 27, 26, 45],
  "46": [68, 62, 66, 53, 84, 73, 50.2, 44.1, 36.9, 67, 27, 26, 46],
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

// Mapiranje Aleksandrovih korekcionih mera → Munro kolona (slovo).
// ODLUKA (Matej „uradi kako mislis", 25.8): korekcije i limiti su u cm na STVARNU meru
// (obim). Za grudi/struk/bokovi bazna je obim (½×2). Ako Aleksandar kasnije kaže drugačije,
// menja se samo ovo mapiranje / semantika.
export const KOREKCIJA_NA_KOLONU: Record<string, string> = {
  grudi: "A",         // ½ Chest → obim
  stomak: "B",        // ½ Waist (struk) → obim
  bokovi: "C",        // ½ Hip → obim
  duzina_napred: "F", // Front Length
  duzina_nazad: "E",  // Back Length
  biceps: "H",        // Upper Arm
  podlaktica: "I",    // Fore Arm
  zglob: "L",         // Cuff (Munro nema zaseban zglob)
  orukavlje: "G",     // Armhole
};

export interface KonacnaMera { key: string; label: string; base: number | null; delta: number; konacno: number | null }

// Konačne „mere sa strane" = bazne (obim) + korekcije, za 9 podesivih mera.
export function konacneMere(velicina: string, korekcije: Record<string, number>): KonacnaMera[] | null {
  const baza = baznaMera(velicina);
  if (!baza) return null;
  const byLetter = new Map(baza.map((b) => [b.letter, b]));
  return MERE_LIMITI.map((m) => {
    const col = byLetter.get(KOREKCIJA_NA_KOLONU[m.key]);
    const base = col ? col.obim : null;
    const delta = korekcije[m.key] ?? 0;
    return { key: m.key, label: m.label, base, delta, konacno: base !== null ? base + delta : null };
  });
}

// Nepodesive bazne mere (za prikaz uz nalog): rame, dužina rukava, kratak rukav, kragna.
export const OSTALE_MERE_SLOVA = ["D", "J", "K", "M"] as const;
