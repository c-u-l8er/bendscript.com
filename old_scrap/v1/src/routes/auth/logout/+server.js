import { redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";

const DEFAULT_REDIRECT = "/auth/login";

async function logout(event) {
  const supabase = (() => {
    if (event.locals?.supabase) return event.locals.supabase;
    try {
      return createSupabaseServerClient(event);
    } catch {
      return null;
    }
  })();

  if (supabase?.auth?.signOut) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Always continue with local cleanup + redirect.
    }
  }

  event.cookies.delete("bendscript_workspace_id", { path: "/" });

  const redirectTo =
    event.url.searchParams.get("redirectTo") || DEFAULT_REDIRECT;
  throw redirect(303, redirectTo);
}

export const POST = logout;
export const GET = logout;
