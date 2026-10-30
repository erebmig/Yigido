// api/check.js — GET /api/check
// cron-job.org her 30sn çağırır → timeout geçtiyse offline yap
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.CHECK_SECRET || "";
const TIMEOUT = 70_000;

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
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.query?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = Date.now();
    const lastSeen = await kvGet("last_seen");
    const status = await kvGet("status");

    if (!lastSeen) return res.status(200).json({ ok: true, note: "no data yet" });

    const elapsed = now - Number(lastSeen);

    if (elapsed > TIMEOUT && status !== "offline") {
      await kvSet("status", "offline");
      return res.status(200).json({ ok: true, action: "set_offline", elapsed });
    }

    return res.status(200).json({ ok: true, status, elapsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
