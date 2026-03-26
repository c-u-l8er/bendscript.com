// ProjectAmp2/bendscript.com/src/routes/auth/callback/+server.js
import { redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";

function getSafeRedirectTarget(raw) {
  const fallback = "/dashboard";
  const value = String(raw || "").trim();

  // Prevent open-redirects to external origins.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;

  return value;
}

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
  const supabase = event.locals?.supabase ?? createSupabaseServerClient(event);
  const code = event.url.searchParams.get("code");
  const next =
    event.url.searchParams.get("next") ??
    event.url.searchParams.get("redirectTo");
  const redirectTo = getSafeRedirectTarget(next);

  if (!code) {
    const reason = encodeURIComponent("missing_oauth_code");
    throw redirect(303, `/auth/login?error=${reason}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.warn("Auth callback exchange failed:", error.message);
    const reason = encodeURIComponent("oauth_exchange_failed");
    throw redirect(303, `/auth/login?error=${reason}`);
  }

  throw redirect(303, redirectTo);
}
