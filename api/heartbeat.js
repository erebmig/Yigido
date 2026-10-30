// api/heartbeat.js — POST /api/heartbeat
// Script her 3sn'de çağırır → webhook yeşil

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
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

async function createWebhook(playerName) {
  const body = {
    embeds: [{
      title: playerName || "Player",
      description: "**Durum:** 🟢  Online",
      color: 0x57f287,
      footer: { text: "Heartbeat System" },
      timestamp: new Date().toISOString(),
    }],
  };
  const res = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-secret"] || req.body?.secret || "";
  if (SECRET && secret !== SECRET) return res.status(401).json({ error: "Unauthorized" });

  const playerName = req.body?.player || "Player";

  try {
    await ensureTable();

    const now = Date.now();
    let messageId = await kvGet("message_id");
    const prevStatus = await kvGet("status");

    await kvSet("last_seen", now);
    await kvSet("player", playerName);

    if (!messageId) {
      messageId = await createWebhook(playerName);
      if (messageId) {
        await kvSet("message_id", messageId);
        await kvSet("status", "online");
      }
    } else if (prevStatus !== "online") {
      await editWebhook(messageId, true, playerName);
      await kvSet("status", "online");
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
