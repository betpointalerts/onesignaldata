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
      const res = await fetch(
        `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users?external_id=${user.row_id}`,
        {
          headers: {
            Authorization: `Basic ${ONESIGNAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const json = await res.json();

      if (json.users?.length) {
        const oneSignalId = json.users[0].id;

        await supabase
          .from("users")
          .update({ one_signal_id: oneSignalId })
          .eq("row_id", user.row_id);

        console.log(`Updated user ${user.row_id}`);
      }
    } catch (err) {
      console.error(`Failed user ${user.row_id}`, err);
    }
  }
}

syncOneSignalIds();
