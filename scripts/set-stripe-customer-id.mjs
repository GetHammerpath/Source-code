#!/usr/bin/env node
/**
 * Set stripe_customer_id on profile for mershard@icloud so sync-subscription queries Stripe correctly.
 * Usage: node --env-file=.env scripts/set-stripe-customer-id.mjs [email]
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)
 */

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const emailArg = process.argv[2] || "mershard@icloud";
const CUSTOMER_ID = "cus_Tr4IXamKKjWsX2";

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) in .env");
  process.exit(1);
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey);

  const { data: profiles, error: pe } = await supabase
    .from("profiles")
    .select("id, email, stripe_customer_id")
    .ilike("email", `%${emailArg}%`);

  if (pe) {
    console.error("Profiles query error:", pe.message);
    process.exit(1);
  }
  if (!profiles?.length) {
    console.error("No profile found for email like:", emailArg);
    process.exit(1);
  }

  const profile = profiles[0];
  console.log("Before:", profile.email, "| stripe_customer_id:", profile.stripe_customer_id || "(none)");

  const { error: ue } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: CUSTOMER_ID })
    .eq("id", profile.id);

  if (ue) {
    console.error("Update error:", ue.message);
    process.exit(1);
  }

  console.log("OK – stripe_customer_id set to", CUSTOMER_ID, "for", profile.email);
  console.log("Next: go to Billing and click 'Refresh subscription status' to sync from Stripe.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
