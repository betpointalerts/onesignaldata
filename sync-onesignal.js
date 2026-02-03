import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with Service Role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

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

  // 2️⃣ Convert all row_ids to strings for OneSignal
  const externalIds = users.map(u => String(u.row_id));

  try {
    // 3️⃣ Make POST request to OneSignal for all external_ids at once
    const res = await fetch("https://onesignal.com/api/v1/players", {
      method: "POST",
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        external_ids: externalIds,
      }),
    });

    const json = await res.json();

    if (!json.players?.length) {
      console.log("No OneSignal players found for these users");
      return;
    }

    console.log(`Received ${json.players.length} players from OneSignal`);

    // 4️⃣ Update Supabase for each user found
    for (const player of json.players) {
      const oneSignalId = player.id;
      const externalId = player.external_id;

      const { error: updateError } = await supabase
        .from("users")
        .update({ one_signal_id: oneSignalId })
        .eq("row_id", externalId);

      if (updateError) {
        console.error(`Failed to update Supabase for ${externalId}:`, updateError);
      } else {
        console.log(`Updated user ${externalId} with OneSignal ID ${oneSignalId}`);
      }
    }
  } catch (err) {
    console.error("Error syncing OneSignal users:", err);
  }
}

syncOneSignalIds();

