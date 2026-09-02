import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let migrated = false;

export async function safeMigrate() {
  if (migrated || !env.DB) return;
  migrated = true;
  const queries = [
    "ALTER TABLE body_measurements ADD COLUMN thigh_cm REAL",
    "ALTER TABLE body_measurements ADD COLUMN calf_cm REAL",
    "ALTER TABLE body_measurements ADD COLUMN neck_cm REAL",
    "ALTER TABLE user_profiles ADD COLUMN birth_date TEXT",
    "ALTER TABLE user_profiles ADD COLUMN sex TEXT",
    "ALTER TABLE user_profiles ADD COLUMN challenge_start_date TEXT",
  ];
  for (const q of queries) {
    try {
      await env.DB.prepare(q).run();
    } catch {
      // Column already exists, safe to ignore
    }
  }
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  void safeMigrate();

  return drizzle(env.DB, { schema });
}

