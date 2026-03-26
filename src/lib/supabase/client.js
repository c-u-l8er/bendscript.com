// ProjectAmp2/bendscript.com/src/lib/supabase/client.js
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let browserClient = null;
let warnedMissingEnv = false;

// Live binding for backwards compatibility with existing imports.
// It remains `null` until `getSupabaseClient()` is called successfully.
export let supabase = null;

function hasRequiredEnv() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function warnMissingEnvOnce() {
  if (warnedMissingEnv) return;
  warnedMissingEnv = true;

  console.warn(
    "Supabase env missing: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY. Supabase features are disabled.",
  );
}

/**
 * Returns a singleton Supabase browser client.
 * - Lazy: initializes only when first requested
 * - Safe: returns null (non-fatal) when env vars are missing
 */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserClient) return browserClient;

  if (!hasRequiredEnv()) {
    warnMissingEnvOnce();
    return null;
  }

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

  supabase = browserClient;
  return browserClient;
}

export function isSupabaseConfigured() {
  return hasRequiredEnv();
}

export default getSupabaseClient;
