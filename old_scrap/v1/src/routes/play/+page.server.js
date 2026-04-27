// ProjectAmp2/bendscript.com/src/routes/play/+page.server.js
import { createSupabaseServerClient } from "$lib/supabase/server";

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const { locals } = event;
  const supabase = locals?.supabase ?? createSupabaseServerClient(event);

  let session = null;
  let user = null;

  if (typeof locals?.safeGetSession === "function") {
    const result = await locals.safeGetSession();
    session = result.session ?? null;
    user = result.user ?? null;
  } else {
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    session = sessionData?.session ?? null;
    user = userData?.user ?? null;
  }

  // Play route supports guest mode — no auth redirect.
  return {
    user: user ? { id: user.id, email: user.email ?? null } : null,
    isGuest: !session,
  };
}
