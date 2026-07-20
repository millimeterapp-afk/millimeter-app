"use client";

import { useState, useEffect, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { searchCustomersLite } from "@/lib/actions/customers";
import { X, Search } from "lucide-react";
import type { Customer } from "@/lib/db/schema";

// Univerzalni birač klijenta sa SERVERSKOM pretragom (ima ~4700 klijenata,
// padajuća lista je neupotrebljiva). Koristi se svuda gdje se bira klijent.
export function CustomerPicker({
  value,
  onChange,
  placeholder,
}: {
  value: { id: string; label: string } | null;
  onChange: (v: { id: string; label: string } | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) { setResults([]); return; }
      startTransition(async () => setResults(await searchCustomersLite(query)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm bg-white">
        <span className="flex-1 truncate">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? "Pretraži klijenta (bar 2 slova)..."}
        className="pl-9"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded-md shadow-lg">
          {searching && <p className="text-sm text-muted-foreground px-3 py-2">Tražim...</p>}
          {!searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-2">Nema rezultata za &quot;{q}&quot;</p>
          )}
          {!searching && results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange({ id: c.id, label: `${c.firstName} ${c.lastName}` }); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
            >
              <span className="truncate">{c.firstName} {c.lastName}</span>
              <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
