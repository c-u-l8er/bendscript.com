// ProjectAmp2/bendscript.com/src/lib/supabase/server.js
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env as publicEnv } from "$env/dynamic/public";
import { env as privateEnv } from "$env/dynamic/private";

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function assertEvent(event) {
  if (!event?.cookies) {
    throw new Error(
      "createSupabaseServerClient requires a SvelteKit `event` with cookies.",
    );
  }
}

/**
 * Creates a per-request Supabase client for server load/actions/routes.
 * Uses anon key + request cookies for auth/session continuity.
 */
export function createSupabaseServerClient(event) {
  assertEvent(event);

  const supabaseUrl = requireEnv(
    "PUBLIC_SUPABASE_URL",
    publicEnv.PUBLIC_SUPABASE_URL,
  );
  const supabaseAnonKey = requireEnv(
    "PUBLIC_SUPABASE_ANON_KEY",
    publicEnv.PUBLIC_SUPABASE_ANON_KEY,
  );

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          event.cookies.set(name, value, {
            path: "/",
            ...options,
          });
        }
      },
    },
  });
}

/**
 * Creates a privileged admin client (service role).
 * Server-only usage for trusted operations (never expose to client).
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv(
    "PUBLIC_SUPABASE_URL",
    publicEnv.PUBLIC_SUPABASE_URL,
  );
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    privateEnv.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Convenience helper for grabbing session in server contexts.
 */
export async function getServerSession(event) {
  const supabase = createSupabaseServerClient(event);
  const { data, error } = await supabase.auth.getSession();

  if (error) return null;
  return data.session ?? null;
}

/**
 * Convenience helper for grabbing user in server contexts.
 */
export async function getServerUser(event) {
  const supabase = createSupabaseServerClient(event);
  const { data, error } = await supabase.auth.getUser();

  if (error) return null;
  return data.user ?? null;
}
