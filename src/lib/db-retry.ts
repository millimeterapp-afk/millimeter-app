// Kratak retry za TRANZIJENTNE DB greške pri paralelnom radu:
//   40P01 deadlock, 40001 serialization, 23505 unique (racy count(*)+1 broj naloga/prodaje).
// Podaci su uvijek bezbjedni — transakcija se u potpunosti vrati na grešku; ovo samo
// sprječava da legitimna paralelna operacija padne bez pokušaja. Funkcija `fn` MORA sama
// da (re)generiše broj i otvori transakciju, da bi retry dobio novi broj.
export async function withTxRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string } | null | undefined)?.code;
      if (attempt < tries && (code === "40P01" || code === "40001" || code === "23505")) {
        await new Promise((r) => setTimeout(r, 20 * attempt));
        continue;
      }
      throw e;
    }
  }
}
