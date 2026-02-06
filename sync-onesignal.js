import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ONESIGNAL_APP_ID,
  ONESIGNAL_API_KEY,
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const LIMIT = 300;

async function syncOneSignalUsers() {
  let offset = 0;
  let totalUpserted = 0;

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

    const data = await res.json();

    if (!data.players || data.players.length === 0) break;

    // Map OneSignal User ID
    const rows = data.players
      .filter(p => p.external_user_id && p.id)
      .map(p => ({
        row_id: String(p.external_user_id), // your internal user id
        onesignal_user_id: p.id,           // ✅ OneSignal User ID
        device_type: p.device_type,
        platform: p.platform,
        is_subscribed: p.notification_types === 1,
        last_active_at: p.last_active,
      }));

    const uniqueRows = Object.values(
      rows.reduce((acc, r) => {
        acc[r.row_id] = r;
        return acc;
      }, {})
    );

    const { error } = await supabase
      .from("onesignal_users")
      .upsert(uniqueRows, { onConflict: ["row_id"] });

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return;
    }

    totalUpserted += uniqueRows.length;
    offset += LIMIT;
  }

  console.log(`✅ Sync complete. Total users upserted: ${totalUpserted}`);
}

syncOneSignalUsers().catch(console.error);
