import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_PREFIX = "duidui_";
const KEY_SECRET_LENGTH = 32;

function generateSecret(): string {
  const arr = new Uint8Array(KEY_SECRET_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function maskKey(secret: string): string {
  if (secret.length <= 8) return "••••••••";
  return "••••••••••••••••••••••••" + secret.slice(-4);
}

async function hashKey(plain: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const method = req.method;
    let body: { action?: string; name?: string; id?: string } = {};
    try {
      if (req.method !== "GET") {
        body = (await req.json()) ?? {};
      }
    } catch {
      // empty body ok for GET or list
    }

    // List keys (GET or POST { action: 'list' })
    const isList = method === "GET" || body.action === "list";
    if (isList) {
      const { data: keys, error } = await supabase
        .from("user_api_keys")
        .select("id, name, key_prefix, last_used_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("api-keys list:", error);
        return json({ success: false, error: "Failed to list keys" }, 500);
      }
      return json({ success: true, keys: keys ?? [] });
    }

    // Create key (POST { action: 'create', name? })
    if (method === "POST" && body.action === "create") {
      const { data: limits } = await supabase
        .from("user_limits")
        .select("api_access_allowed")
        .eq("user_id", user.id)
        .single();
      if (limits?.api_access_allowed === false) {
        return json(
          { success: false, error: "API access has been revoked for this account." },
          403
        );
      }

      const name = typeof body.name === "string" ? body.name.trim() : "API Key";
      if (!name) {
        return json({ success: false, error: "Name is required" }, 400);
      }

      const secret = generateSecret();
      const fullKey = KEY_PREFIX + secret;
      const keyHash = await hashKey(fullKey);
      const keyPrefix = KEY_PREFIX + maskKey(secret);

      const { data: row, error: insertError } = await supabase
        .from("user_api_keys")
        .insert({
          user_id: user.id,
          name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
        })
        .select("id, name, key_prefix, created_at")
        .single();

      if (insertError) {
        console.error("api-keys create:", insertError);
        return json({ success: false, error: "Failed to create key" }, 500);
      }

      return json({
        success: true,
        key: fullKey,
        id: row.id,
        name: row.name,
        key_prefix: row.key_prefix,
        created_at: row.created_at,
      });
    }

    // Revoke key (POST { action: 'revoke', id } or DELETE with body { id })
    const isRevoke = (method === "POST" && body.action === "revoke") || method === "DELETE";
    if (isRevoke) {
      const id = body.id;
      if (!id || typeof id !== "string") {
        return json({ success: false, error: "Key id is required" }, 400);
      }

      const { error: deleteError } = await supabase
        .from("user_api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("api-keys revoke:", deleteError);
        return json({ success: false, error: "Failed to revoke key" }, 500);
      }
      return json({ success: true });
    }

    return json({ success: false, error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("api-keys:", e);
    return json(
      { success: false, error: e instanceof Error ? e.message : "Server error" },
      500
    );
  }
});
