import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Supabase client with Service Role
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

async function syncOneSignalIds() {
  // 1️⃣ Fetch all users without one_signal_id
  const { data: users, error } = await supabase
    .from("users")
    .select("row_id")
    .is("one_signal_id", null);

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  if (!users?.length) {
    console.log("No users to sync");
    return;
  }

  console.log(`Syncing ${users.length} users`);

  // 2️⃣ Loop through each row_id and fetch player
  for (const u of users) {
    const rowId = String(u.row_id);

    try {
      const res = await fetch(
        `https://onesignal.com/api/v1/players?external_user_id=${rowId}`,
        {
          headers: {
            Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res.json();

      if (!json.players || !json.players.length) {
        console.log(`No OneSignal player found for ${rowId}`);
        continue;
      }

      const playerId = json.players[0].id;

      // 3️⃣ Upsert player_id into Supabase
      const { error: updateError } = await supabase
        .from("users")
        .update({ one_signal_id: playerId })
        .eq("row_id", rowId);

      if (updateError) {
        console.error(`Failed to update ${rowId}:`, updateError);
      } else {
        console.log(`Updated ${rowId} with OneSignal ID ${playerId}`);
      }
    } catch (err) {
      console.error(`Error fetching OneSignal player for ${rowId}:`, err);
    }
  }
}

syncOneSignalIds();
