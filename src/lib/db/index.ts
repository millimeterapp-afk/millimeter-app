import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Singleton pattern — sprječava otvaranje stotina konekcija u Next.js dev modu
const globalForDb = globalThis as unknown as { client: postgres.Sql | undefined };

const client =
  globalForDb.client ??
  postgres(connectionString, {
    prepare: false, // obavezno za Supabase transaction pooler
    max: 3,         // maksimalno 3 konekcije — dovoljno za dev
    idle_timeout: 10,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
