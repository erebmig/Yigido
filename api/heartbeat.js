// api/heartbeat.js — POST /api/heartbeat
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.HEARTBEAT_SECRET || "";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS heartbeat (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
}

async function kvGet(key) {
  const rows = await sql`SELECT value FROM heartbeat WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

async function kvSet(key, value) {
  await sql`
    INSERT INTO heartbeat (key, value) VALUES (${key}, ${String(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.body?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  const playerName = req.body?.player || "Player";

  try {
    await ensureTable();
    const now = Date.now();
    await kvSet("last_seen", now);
    await kvSet("player", playerName);
    await kvSet("status", "online");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
