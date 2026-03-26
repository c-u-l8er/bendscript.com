// ProjectAmp2/bendscript.com/src/hooks.server.js
import { createSupabaseServerClient } from "$lib/supabase/server";

/**
 * SvelteKit server hook:
 * - creates a request-scoped Supabase client in `event.locals.supabase`
 * - exposes `event.locals.safeGetSession()` that validates session + user
 */
export async function handle({ event, resolve }) {
  event.locals.supabase = createSupabaseServerClient(event);

  event.locals.safeGetSession = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await event.locals.supabase.auth.getSession();

    if (sessionError || !session) {
      return { session: null, user: null };
    }

    const {
      data: { user },
      error: userError,
    } = await event.locals.supabase.auth.getUser();

    if (userError || !user) {
      return { session: null, user: null };
    }

    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
}
