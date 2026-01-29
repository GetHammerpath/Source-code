import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function short(id) {
  return typeof id === "string" ? `${id.slice(0, 8)}…` : String(id);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
  const SUPABASE_ANON_KEY = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const runOne = async ({ label, generationType, imageUrl }) => {
    const email = `kie-e2e+${label}+${Date.now()}@example.com`;
    const password = `Test!${Math.random().toString(16).slice(2)}Aa1`;

    await supabase.auth.signUp({ email, password });
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signIn?.session) {
      throw new Error(`Failed to sign in temp user: ${signInError?.message || "no session"}`);
    }

    const session = signIn.session;
    const userId = session.user.id;

    const avatarName = "Mike";
    const script = "Hi! This is a quick end-to-end test. Keep it short and neutral.";
    const prompt = "A friendly presenter speaks clearly and professionally.";

    const { data: gen, error: genErr } = await supabase
      .from("kie_video_generations")
      .insert({
        user_id: userId,
        image_url: imageUrl,
        industry: "avatar",
        avatar_name: avatarName,
        city: "—",
        script,
        metadata: {
          e2e: true,
          e2e_mode: label,
          generation_type: generationType,
          source: "scripts/test-kie-generate-video.mjs",
        },
      })
      .select("id")
      .single();

    if (genErr || !gen?.id) {
      throw new Error(`Failed to insert generation row: ${genErr?.message || "unknown error"}`);
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/kie-generate-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        generation_id: gen.id,
        prompt,
        image_url: imageUrl,
        avatar_name: avatarName,
        industry: "avatar",
        script,
        aspect_ratio: "16:9",
        generation_type: generationType,
      }),
    });

    const raw = await res.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { raw: raw.slice(0, 500) };
    }
    if (!res.ok || body?.success === false) {
      throw new Error(`[${label}] kie-generate-video failed (${res.status}): ${body?.error || raw}`);
    }

    const taskId = body?.task_id;
    if (!taskId) throw new Error(`[${label}] missing task_id. Response: ${raw}`);

    const readGeneration = async () => {
      const { data: updated, error: updErr } = await supabase
        .from("kie_video_generations")
        .select(
          "initial_status, initial_task_id, initial_video_url, initial_error, final_video_url, metadata"
        )
        .eq("id", gen.id)
        .single();
      if (updErr) throw updErr;
      return updated;
    };

    const firstRead = await readGeneration();
    console.log(
      JSON.stringify(
        {
          ok: true,
          phase: "started",
          mode: label,
          user: short(userId),
          generation_id: short(gen.id),
          task_id: taskId,
          initial_status: firstRead?.initial_status,
        },
        null,
        2
      )
    );

    const maxAttempts = 20; // ~5 minutes
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await sleep(15_000);
      const pollRes = await fetch(`${SUPABASE_URL}/functions/v1/kie-check-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ generation_id: gen.id }),
      });
      await pollRes.text().catch(() => "");

      const g = await readGeneration();
      const done =
        g?.initial_status === "completed" ||
        g?.initial_status === "failed" ||
        !!g?.initial_video_url ||
        !!g?.final_video_url;

      console.log(
        JSON.stringify(
          {
            phase: "poll",
            mode: label,
            attempt,
            initial_status: g?.initial_status,
            has_initial_video_url: !!g?.initial_video_url,
            has_initial_error: !!g?.initial_error,
          },
          null,
          2
        )
      );

      if (done) {
        console.log(
          JSON.stringify(
            {
              ok: g?.initial_status !== "failed",
              phase: "done",
              mode: label,
              initial_status: g?.initial_status,
              initial_video_url: g?.initial_video_url || null,
              initial_error: g?.initial_error || null,
            },
            null,
            2
          )
        );
        return g;
      }
    }

    const last = await readGeneration();
    console.log(
      JSON.stringify(
        {
          ok: true,
          phase: "timeout",
          mode: label,
          message: "Timed out waiting for completion (still generating).",
          initial_status: last?.initial_status,
        },
        null,
        2
      )
    );
    return last;
  };

  // 1) Text-to-video (no input image)
  await runOne({
    label: "text",
    generationType: "TEXT_2_VIDEO",
    imageUrl: "text-to-video",
  });

  // 2) Reference-to-video with a safe, non-IP avatar image (DiceBear)
  await runOne({
    label: "reference",
    generationType: "REFERENCE_2_VIDEO",
    imageUrl: "https://api.dicebear.com/7.x/avataaars/png?seed=kie-e2e-safe&size=1024",
  });
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

