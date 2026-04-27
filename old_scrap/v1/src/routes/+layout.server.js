import { createSupabaseServerClient } from "$lib/supabase/server";

/** @type {import('./$types').LayoutServerLoad} */
export async function load(event) {
  if (typeof event.locals?.safeGetSession === "function") {
    const { session, user } = await event.locals.safeGetSession();
    return {
      session: session ?? null,
      user: user ?? null,
    };
  }

  const supabase = createSupabaseServerClient(event);

  const [
    { data: sessionData, error: sessionError },
    { data: userData, error: userError },
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  return {
    session: sessionError ? null : (sessionData?.session ?? null),
    user: userError ? null : (userData?.user ?? null),
  };
}
