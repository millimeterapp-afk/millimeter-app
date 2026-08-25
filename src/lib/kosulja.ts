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
