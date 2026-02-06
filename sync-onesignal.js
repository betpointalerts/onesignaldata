import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY; // Must be App REST API Key
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;

async function setEmailInOneSignal() {
  const { data: users, error } = await supabase
    .from("users")
    .select("row_id")
    .is("one_signal_id", null);

  if (error) return console.error(error);
  if (!users?.length) return console.log("No users to update");

  for (const u of users) {
    const rowId = String(u.row_id).trim();

    try {
      // Lookup the user via the Users API
      const res = await fetch(
        `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(rowId)}`,
        {
          headers: {
            Authorization: `Key ${ONESIGNAL_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.status !== 200) {
        console.log(`No OneSignal user found for row_id=${rowId}`);
        continue;
      }

      const userJson = await res.json();
      const oneSignalId = userJson.identity?.onesignal_id;

      if (!oneSignalId) {
        console.log(`User found but no OneSignal ID for row_id=${rowId}`);
        continue;
      }

      console.log(`Found OneSignal user ID=${oneSignalId} for row_id=${rowId}`);

      // Optional: update email in OneSignal (user identity level)
      await fetch(
        `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(rowId)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Key ${ONESIGNAL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identity: { email: "1" }
          }),
        }
      );

      console.log(`Updated OneSignal user email for row_id=${rowId}`);

      // Update `users.one_signal_id` in Supabase
      await supabase
        .from("users")
        .update({ one_signal_id: oneSignalId })
        .eq("row_id", rowId);

    } catch (err) {
      console.error(`Error processing row_id=${rowId}:`, err);
    }
  }
}

setEmailInOneSignal();
