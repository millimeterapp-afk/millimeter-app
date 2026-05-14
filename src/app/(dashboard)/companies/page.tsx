import { getCompany } from "@/lib/actions/settings";
import Link from "next/link";

export default async function CompaniesPage() {
  const company = await getCompany();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kompanije</h1>
        <p className="text-muted-foreground text-sm mt-1">Informacije o firmi</p>
      </div>

      {company ? (
        <div className="border rounded-xl p-6 space-y-4 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{company.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {company.country ?? "—"} · {company.currency}
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">Aktivna</span>
          </div>
          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            {[
              { label: "PDV broj", value: company.taxId ?? "—" },
              { label: "Adresa", value: company.address ?? "—" },
              { label: "Valuta", value: company.currency },
              { label: "Zemlja", value: company.country ?? "—" },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <Link href="/settings" className="text-sm text-black underline">
              Uredi u Podešavanjima →
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
          Firma nije pronađena.
        </div>
      )}
    </div>
  );
}
