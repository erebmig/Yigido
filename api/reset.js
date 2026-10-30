// api/reset.js — POST /api/reset
// DB'yi temizler, yeni webhook mesajı oluşturur

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.HEARTBEAT_SECRET || "";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.body?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    await sql`DELETE FROM heartbeat`;
    return res.status(200).json({ ok: true, note: "Cleared. Next heartbeat creates a fresh message." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
