import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ==========================
// ENV
// ==========================
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ONESIGNAL_APP_ID,
  ONESIGNAL_API_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
  throw new Error("Missing required environment variables");
}

// ==========================
// SUPABASE CLIENT
// ==========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const LIMIT = 300;

// ==========================
// MAIN FUNCTION
// ==========================
async function syncOneSignal() {
  let offset = 0;
  let total = 0;

  while (true) {
    const res = await fetch(
      `https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=${LIMIT}&offset=${offset}`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { players } = await res.json();
    if (!players || players.length === 0) break;

    // ==========================
    // MAP → ROWS
    // ==========================
    const rows = players
      .filter(p => p.external_user_id && p.id) // must have both
      .map(p => ({
        row_id: String(p.external_user_id), // your internal user ID
        player_id: p.id,                     // ✅ OneSignal PLAYER ID
        device_type: p.device_type,
        platform: p.platform,
        is_subscribed: p.notification_types === 1,
        last_active_at: p.last_active,       // epoch seconds
      }));

    // ==========================
    // DEDUPE BY row_id
    // ==========================
    const uniqueRows = Object.values(
      rows.reduce((acc, r) => {
        acc[r.row_id] = r; // last device wins if duplicates
        return acc;
      }, {})
    );

    // ==========================
    // UPSERT TO SUPABASE
    // ==========================
    const { error } = await supabase
      .from("onesignal_users")
      .upsert(uniqueRows, { onConflict: ["row_id"] });

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return;
    }

    total += uniqueRows.length;
    console.log(`Imported ${uniqueRows.length} users (offset=${offset})`);

    offset += LIMIT;
  }

  console.log(`✅ Done. Total users upserted: ${total}`);
}

// ==========================
// RUN
// ==========================
syncOneSignal().catch(console.error);

  console.log(`✅ Done. Total users upserted: ${total}`);
}

syncOneSignal();
