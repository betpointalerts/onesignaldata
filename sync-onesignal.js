import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID; // <-- make sure this is set

async function setEmailInOneSignal() {
  // 1️⃣ Select all users with a row_id
  const { data: users, error } = await supabase
    .from("users")
    .select("row_id")
    .is("one_signal_id", null); // or all users you want to test

  if (error) return console.error(error);
  if (!users?.length) return console.log("No users to update");

  for (const u of users) {
    const rowId = String(u.row_id).trim(); // trim spaces

    try {
      // 2️⃣ Get player in OneSignal by external_user_id (must include app_id)
      const res = await fetch(
        `https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&external_user_id=${encodeURIComponent(rowId)}`,
        {
          headers: {
            Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res.json();
      if (!json.players?.length) {
        console.log(`No OneSignal player found for row_id=${rowId}`);
        continue;
      }

      const playerId = json.players[0].id;
      console.log(`Found player ${playerId} for row_id=${rowId}`);

      // 3️⃣ Update the player's email field in OneSignal
      const updateRes = await fetch(
        `https://onesignal.com/api/v1/players/${playerId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "1" }) // test value
        }
      );

      const updateJson = await updateRes.json();
      console.log(`Updated OneSignal player:`, updateJson);

    } catch (err) {
      console.error(`Error updating row_id=${rowId}:`, err);
    }
  }
}

setEmailInOneSignal();
