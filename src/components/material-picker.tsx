"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { searchMaterials } from "@/lib/actions/inventory";
import { X } from "lucide-react";

// Pretraga materijala iz baze (2.000+), serverski (searchMaterials, po rečima).
// Bira se jedan materijal; vrednost je naziv materijala. `salePrice` u onChange (ako
// materijal ima unetu prodajnu cenu) — poziva se sa null kad se cena ne zna (Aleksandrov
// komentar R8, 2.9: cena da se automatski popuni kad se izabere materijal).
export function MaterialPicker({ value, onChange, placeholder }: {
  value: string;
  onChange: (name: string, salePrice?: number | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; code: string | null; category: string | null; salePrice: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [, startSearch] = useTransition();
  const ridRef = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) return; // prazan upit — ne diramo state sinhrono (render se čuva q.trim() uslovom)
    const rid = ++ridRef.current;
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await searchMaterials(query);
        if (ridRef.current === rid) setResults(r);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="mt-1 flex items-center justify-between border rounded-md px-3 py-2 bg-white">
        <span className="text-sm">{value}</span>
        <button type="button" onClick={() => { onChange(""); setQ(""); }}
          className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="mt-1 relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
        placeholder={placeholder ?? "Pretraži materijal (npr. Carpi 400/70, Getzner)..."} />
      {open && q.trim() && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto border rounded-md bg-white shadow-lg">
          {results.map((m) => (
            <button key={m.id} type="button"
              onClick={() => { onChange(m.name, m.salePrice != null ? Number(m.salePrice) : null); setQ(""); setResults([]); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0">
              <p className="text-sm">{m.name}</p>
              <p className="text-xs text-muted-foreground">
                {m.category ?? "—"}{m.code ? ` · ${m.code}` : ""}
                {m.salePrice != null && ` · RSD ${Number(m.salePrice).toLocaleString("sr-RS")}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
