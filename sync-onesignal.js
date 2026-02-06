import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

async function syncOneSignalIds() {
  // 1️⃣ Select all users without one_signal_id
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

  // 2️⃣ Loop through each user
  for (const u of users) {
    const rowId = String(u.row_id); // convert to string for OneSignal

    try {
      // 2a️⃣ Fetch player info from OneSignal by external_user_id
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

      if (!json.players || json.players.length === 0) {
        console.log(`No OneSignal player found for row_id=${rowId}`);
        continue;
      }

      const playerId = json.players[0].id;
      console.log(`Found player_id=${playerId} for row_id=${rowId}`);

      // 2b️⃣ Update users table with player_id
      const { error: updateError } = await supabase
        .from("users")
        .update({ one_signal_id: playerId })
        .eq("row_id", u.row_id); // match original type

      if (updateError) {
        console.error(`Failed to update row_id=${rowId}:`, updateError);
      } else {
        console.log(`Updated row_id=${rowId} with one_signal_id=${playerId}`);
      }
    } catch (err) {
      console.error(`Error processing row_id=${rowId}:`, err);
    }
  }
}

syncOneSignalIds();
