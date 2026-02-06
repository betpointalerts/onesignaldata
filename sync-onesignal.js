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

const LIMIT = 300;

// ==========================
// MAIN
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

    const data = await res.json();
    if (!data.players || data.players.length === 0) break;

    const rows = data.players
      .filter(p => p.external_user_id)
      .map(p => ({
        row_id: String(p.external_user_id),
        onesignal_id: p.id,
      }));

    // dedupe by row_id
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
      console.error("Supabase upsert error:", error);
      return;
    }

    total += uniqueRows.length;
    console.log(`Imported ${uniqueRows.length} users (offset=${offset})`);
    offset += LIMIT;
  }

  console.log(`✅ Done. Total users upserted: ${total}`);
}

syncOneSignal().catch(console.error);
