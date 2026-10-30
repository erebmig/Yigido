// api/status.js — GET /api/status
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.HEARTBEAT_SECRET || "";

async function kvGet(key) {
  const rows = await sql`SELECT value FROM heartbeat WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.query?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const status = await kvGet("status") || "offline";
    const lastSeen = await kvGet("last_seen");
    const player = await kvGet("player") || "Unknown";
    const jobId = await kvGet("job_id") || "";
    const placeId = await kvGet("place_id") || "142823291";
    return res.status(200).json({ status, lastSeen, player, jobId, placeId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
