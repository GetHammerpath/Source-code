#!/usr/bin/env node
/**
 * Find user by email, check subscriptions, repair if missing.
 * Usage: node --env-file=.env scripts/check-and-repair-subscription.mjs [email]
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)
 */

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const emailArg = process.argv[2] || "mershard@icloud";

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
  console.log("Profile:", profile.id, profile.email, "stripe_customer_id:", profile.stripe_customer_id || "(none)");

  const { data: subs, error: se } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", profile.id);

  if (se) {
    console.error("Subscriptions query error:", se.message);
    process.exit(1);
  }

  console.log("Subscriptions:", subs?.length ?? 0, subs?.map((s) => ({ plan: s.plan, status: s.status })) ?? []);

  const active = subs?.find((s) => s.status === "active" || s.status === "trialing");
  if (active) {
    console.log("OK – Active subscription exists.");
    return;
  }

  console.log("No active subscription. Inserting repair row...");
  const { error: ins } = await supabase.from("subscriptions").upsert(
    {
      user_id: profile.id,
      plan: "studio_access",
      status: "active",
      stripe_subscription_id: profile.stripe_customer_id ? `repair_${profile.id}` : null,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
    },
    { onConflict: "user_id,status" }
  );

  if (ins) {
    console.error("Insert error:", ins.message);
    process.exit(1);
  }
  console.log("OK – Subscription repair row inserted for", profile.email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
