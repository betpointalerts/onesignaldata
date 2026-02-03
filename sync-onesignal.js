import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

async function syncOneSignalIds() {
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

  for (const user of users) {
    try {
      const externalId = String(user.row_id);

      // Correct POST request to query OneSignal by external_id
      const res = await fetch(`https://onesignal.com/api/v1/players`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          external_ids: [externalId],
        }),
      });

      const json = await res.json();
      console.log(`OneSignal response for ${externalId}:`, json);

      if (json.players?.length > 0) {
        const oneSignalId = json.players[0].id;

        const { error: updateError } = await supabase
          .from("users")
          .update({ one_signal_id: oneSignalId })
          .eq("row_id", user.row_id);

        if (updateError) {
          console.error(`Failed to update Supabase for ${user.row_id}:`, updateError);
        } else {
          console.log(`Updated user ${user.row_id} with OneSignal ID ${oneSignalId}`);
        }
      } else {
        console.log(`No OneSignal player found for ${externalId}`);
      }
    } catch (err) {
      console.error(`Error syncing user ${user.row_id}:`, err);
    }
  }
}

syncOneSignalIds();

