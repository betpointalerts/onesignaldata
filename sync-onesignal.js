import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_ID = process.env.ONESIGNAL_APP_ID;
const REST_KEY = process.env.ONESIGNAL_API_KEY;
const PAGE_SIZE = 300;

async function fetchAllPlayers() {
  let offset = 0;
  let total = 0;

  while (true) {
    const res = await fetch(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: {
        Authorization: `Basic ${REST_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();

    if (!json.players || json.players.length === 0) break;

    const rows = json.players.map((p) => ({
      row_id: p.external_user_id,
      player_id: p.id,
      device_type: p.device_type,
      email: p.identifier || null,
      last_active: p.last_active ? new Date(p.last_active * 1000).toISOString() : null,
      session_count: p.session_count || 0,
      language: p.language || null,
      tags: p.tags || {},
      notification_types: p.notification_types || 0,
    }));

    // Upsert into Supabase
    const { error } = await supabase.from("onesignal_users").upsert(rows, { onConflict: ["row_id"] });
    if (error) console.error("Supabase upsert error:", error);

    total += rows.length;
    console.log(`Imported ${rows.length} players (offset=${offset})`);

    if (json.players.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`✅ Done. Total users upserted: ${total}`);
}

fetchAllPlayers().catch(console.error);
