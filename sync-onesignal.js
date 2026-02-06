import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ==========================
// ENV
// ==========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
  throw new Error("Missing required environment variables");
}

// ==========================
// CLIENT
// ==========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==========================
// CONFIG
// ==========================
const LIMIT = 300;

// ==========================
// MAIN
// ==========================
async function syncOneSignal() {
  let offset = 0;
  let totalUpserted = 0;

  while (true) {
    const url = `https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=${LIMIT}&offset=${offset}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();

    if (!json.players || json.players.length === 0) break;

    // ==========================
    // MAP → ROWS
    // ==========================
    const rows = json.players
      .filter(p => p.external_user_id)
      .map(p => ({
        row_id: String(p.external_user_id), // your user id
        onesignal_id: p.id,
        device_type: p.device_type,
        platform: p.platform,
        is_subscribed: p.notification_types === 1,
        last_active_at: p.last_active,
      }));

    // ==========================
    // DEDUPE (row_id)
    // ==========================
    const uniqueRows = Object.values(
      rows.reduce((acc, row) => {
        acc[row.row_id] = row; // last device wins
        return acc;
      }, {})
    );

    // ==========================
    // UPSERT
    // ==========================
    const { error } = await supabase
      .from("onesignal_users")
      .upsert(uniqueRows, { onConflict: ["row_id"] });

    if (error) {
      console.error("Supabase upsert error:", error);
      break;
    }

    totalUpserted += uniqueRows.length;
    console.log(`Imported ${uniqueRows.length} users (offset=${offset})`);

    offset += LIMIT;
  }

  console.log(`✅ Done. Total users upserted: ${totalUpserted}`);
}

// ==========================
// RUN
// ==========================
syncOneSignal().catch(console.error);
