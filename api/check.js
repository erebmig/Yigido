// api/check.js — GET /api/check
// cron-job.org her 5sn çağırır → 6sn heartbeat gelmezse kırmızı

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SECRET = process.env.CHECK_SECRET || "";
const TIMEOUT = 70_000;
const COOLDOWN = 120_000;

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

async function editWebhook(messageId, green, playerName) {
  const body = {
    embeds: [{
      title: playerName || "Player",
      description: green ? "**Durum:** 🟢  Online" : "**Durum:** 🔴  Offline",
      color: green ? 0x57f287 : 0xed4245,
      footer: { text: "Heartbeat System" },
      timestamp: new Date().toISOString(),
    }],
  };
  const res = await fetch(`${WEBHOOK_URL}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.query?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = Date.now();
    const lastSeen = await kvGet("last_seen");
    const messageId = await kvGet("message_id");
    const status = await kvGet("status");
    const playerName = await kvGet("player") || "Player";
    const lastOfflineAt = await kvGet("last_offline_at") || "0";

    if (!messageId || !lastSeen) return res.status(200).json({ ok: true, note: "no data yet" });

    const elapsed = now - Number(lastSeen);

    if (elapsed > TIMEOUT && status !== "offline") {
      if (now - Number(lastOfflineAt) > COOLDOWN) {
        const ok = await editWebhook(messageId, false, playerName);
        if (ok) {
          await kvSet("status", "offline");
          await kvSet("last_offline_at", now);
        }
        return res.status(200).json({ ok, action: "set_offline", elapsed });
      }
    }

    return res.status(200).json({ ok: true, status, elapsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
