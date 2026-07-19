// Lokalni datum radnje (Beograd). Server radi u UTC, pa bi
// new Date().toISOString() između lokalne ponoći i ~02h ljeti upisao
// prethodni dan — uplata bi pala u pogrešan dan (i mjesečni izvještaj
// u pogrešan mjesec). Ovaj helper uvijek vraća datum kako ga vidi radnja.
export function belgradeToday(): string {
  // en-CA daje format YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
}
