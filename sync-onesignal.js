import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;
const APP_ID = process.env.ONESIGNAL_APP_ID; // your OneSignal app ID
const PAGE_SIZE = 300; // OneSignal max per request

async function fetchAllPlayers() {
  let offset = 0;
  let totalFetched = 0;

  while (true) {
    const res = await fetch(
      `https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=${PAGE_SIZE}&offset=${offset}`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const json = await res.json();
    if (!json.players?.length) break;

    console.log(`Fetched ${json.players.length} players (offset=${offset})`);

    // Upsert into Supabase
    const rows = json.players.map((p) => ({
      row_id: p.external_user_id,
      player_id: p.id,
      email: p.identifier || null,
      device_type: p.device_type,
      last_active: p.last_active ? new Date(p.last_active * 1000).toISOString() : null,
      session_count: p.session_count || 0,
      tags: p.tags || {},
      language: p.language || null,
      notification_types: p.notification_types || 0,
    }));

    const { error } = await supabase
      .from("onesignal_users")
      .upsert(rows, { onConflict: ["row_id"] });

    if (error) {
      console.error("Supabase upsert error:", error);
    } else {
      totalFetched += rows.length;
    }

    if (json.players.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  console.log(`✅ Done. Total users upserted: ${totalFetched}`);
}

fetchAllPlayers().catch(console.error);
