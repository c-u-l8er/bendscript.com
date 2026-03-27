// ProjectAmp2/bendscript.com/src/lib/supabase/client.js
import { createBrowserClient } from "@supabase/ssr";
import { env as dynamicPublicEnv } from "$env/dynamic/public";

let browserClient = null;
let warnedMissingEnv = false;

// Live binding for backwards compatibility with existing imports.
// It remains `null` until `getSupabaseClient()` is called successfully.
export let supabase = null;

const URL_KEYS = [
  "PUBLIC_SUPABASE_URL",
  "VITE_PUBLIC_SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
];

const ANON_KEYS = [
  "PUBLIC_SUPABASE_ANON_KEY",
  "VITE_PUBLIC_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readImportMetaEnv() {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env) {
      return import.meta.env;
    }
  } catch {
    // no-op
  }
  return {};
}

function readWindowEnv() {
  if (typeof window === "undefined") return {};

  // common runtime injection patterns
  const fromWindow =
    window.__ENV__ || window.__env__ || window.ENV || window.env || {};

  return typeof fromWindow === "object" && fromWindow ? fromWindow : {};
}

function readDynamicPublicEnv() {
  return dynamicPublicEnv && typeof dynamicPublicEnv === "object"
    ? dynamicPublicEnv
    : {};
}

function pickFirstKey(sources, keys) {
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key];
      if (isNonEmptyString(value)) {
        return { value: value.trim(), key };
      }
    }
  }
  return { value: "", key: null };
}

function resolveSupabaseEnv() {
  const sources = [
    readDynamicPublicEnv(),
    readImportMetaEnv(),
    readWindowEnv(),
  ];

  const resolvedUrl = pickFirstKey(sources, URL_KEYS);
  const resolvedAnon = pickFirstKey(sources, ANON_KEYS);

  return {
    url: resolvedUrl.value,
    anonKey: resolvedAnon.value,
    urlKey: resolvedUrl.key,
    anonKeyName: resolvedAnon.key,
  };
}

function hasRequiredEnv(resolved) {
  return Boolean(resolved?.url && resolved?.anonKey);
}

function warnMissingEnvOnce(resolved) {
  if (warnedMissingEnv) return;
  warnedMissingEnv = true;

  const missing = [];
  if (!resolved?.url) missing.push("PUBLIC_SUPABASE_URL");
  if (!resolved?.anonKey) missing.push("PUBLIC_SUPABASE_ANON_KEY");

  console.warn(
    `Supabase env missing: set ${missing.join(" and ")} (fallbacks supported: ${[
      ...URL_KEYS,
      ...ANON_KEYS,
    ].join(", ")}). Supabase features are disabled.`,
  );
}

export function getSupabaseEnvStatus() {
  const resolved = resolveSupabaseEnv();
  return {
    configured: hasRequiredEnv(resolved),
    urlKey: resolved.urlKey,
    anonKeyName: resolved.anonKeyName,
    hasUrl: Boolean(resolved.url),
    hasAnonKey: Boolean(resolved.anonKey),
  };
}

/**
 * Returns a singleton Supabase browser client.
 * - Lazy: initializes only when first requested
 * - Safe: returns null (non-fatal) when env vars are missing
 * - Resilient: resolves env values from dynamic public env + common fallback keys
 */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserClient) return browserClient;

  const resolved = resolveSupabaseEnv();

  if (!hasRequiredEnv(resolved)) {
    warnMissingEnvOnce(resolved);
    return null;
  }

  browserClient = createBrowserClient(resolved.url, resolved.anonKey, {
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
  return hasRequiredEnv(resolveSupabaseEnv());
}

export default getSupabaseClient;
