"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Došlo je do greške</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {error.message || "Neočekivana greška. Pokušaj ponovo ili kontaktiraj podršku."}
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Pokušaj ponovo
      </button>
    </div>
  );
}
