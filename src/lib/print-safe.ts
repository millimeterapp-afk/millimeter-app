// Bezbedno ubacivanje korisničkih vrednosti u HTML koji se piše preko
// `document.write` (štampa naloga/barkodova). React normalno escape-uje sam,
// ali ovi print prozori grade HTML ručno kao string, pa moramo mi.
export function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Za vrednost koja ide UNUTAR JS string literala u <script> bloku (npr.
// JsBarcode("#id", "VALUE", ...)) — HTML escape ovde nije dovoljan, treba
// izbeći navodnike/backslash/zatvaranje </script> i unutar same JS string konstante.
export function escapeJsString(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, "\\x3C")
    .replace(/>/g, "\\x3E")
    .replace(/\r?\n/g, "\\n");
}
