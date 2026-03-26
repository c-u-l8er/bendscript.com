import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let browserClient = null;

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env missing: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY",
    );
  }
}

/**
 * Returns a singleton Supabase browser client.
 * Safe to import in shared modules; only initializes in the browser.
 */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserClient) return browserClient;

  assertEnv();

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        "x-client-info": "bendscript-web",
      },
    },
  });

  return browserClient;
}

export const supabase = getSupabaseClient();

export default supabase;
