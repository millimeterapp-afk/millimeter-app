// Lojalni nivoi — pragovi u RSD.
//
// PAŽNJA: raniji pragovi (500 / 1500 / 3000) bili su iz doba kad su cijene bile
// u evrima. Kad su cijene prebačene na dinare, pragovi su ostali isti, pa bi
// jedna košulja (~15.000 RSD) klijenta odmah gurnula u Platinum. Ovdje su
// preračunati na dinarsku protivvrijednost istog poslovnog smisla
// (~500 / 1500 / 3000 EUR po kursu ~117).
//
// TODO: dati Nikoli/Aleksandru da potvrde konkretne iznose — ovo je poslovna
// odluka (ko je Gold), ne tehnička.
export const LOYALTY_THRESHOLDS_RSD = {
  Silver: 60_000,
  Gold: 175_000,
  Platinum: 350_000,
} as const;

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export function calcLoyaltyTier(totalSpentRsd: number): LoyaltyTier {
  if (totalSpentRsd >= LOYALTY_THRESHOLDS_RSD.Platinum) return "Platinum";
  if (totalSpentRsd >= LOYALTY_THRESHOLDS_RSD.Gold) return "Gold";
  if (totalSpentRsd >= LOYALTY_THRESHOLDS_RSD.Silver) return "Silver";
  return "Bronze";
}
