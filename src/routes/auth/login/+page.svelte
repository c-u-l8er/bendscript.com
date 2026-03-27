<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    getSupabaseClient,
    isSupabaseConfigured,
  } from "$lib/supabase/client";

  let email = $state("");
  let isEmailLoading = $state(false);
  let isGoogleLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  const redirectTo = $derived(
    $page.url.searchParams.get("redirectTo") || "/dashboard",
  );

  const supabaseConfigured = $derived(isSupabaseConfigured());
  const missingEnvVars = $derived(
    ["PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY"].join(" and "),
  );

  function getEnvSetupMessage() {
    return `Supabase is not configured. Set ${missingEnvVars} in your local environment, restart the dev server, and reload this page.`;
  }

  function getCallbackUrl() {
    if (typeof window === "undefined") return "";
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("redirectTo", redirectTo);
    return callback.toString();
  }

  async function ensureSignedOutState() {
    try {
      if (!supabaseConfigured) return;
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await goto(redirectTo, { replaceState: true });
      }
    } catch {
      // noop: keep login page usable even if session check fails
    }
  }

  onMount(() => {
    ensureSignedOutState();
  });

  async function handleEmailSignIn(event) {
    event.preventDefault();
    errorMessage = "";
    successMessage = "";

    const normalized = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      errorMessage = "Please enter your email address.";
      return;
    }

    isEmailLoading = true;

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(getEnvSetupMessage());
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: getCallbackUrl(),
        },
      });

      if (error) throw error;

      successMessage =
        "Check your inbox for a magic link to sign in. You can close this tab after clicking the link.";
      email = "";
    } catch (err) {
      errorMessage = err?.message || "Unable to send sign-in link.";
    } finally {
      isEmailLoading = false;
    }
  }

  async function handleGoogleSignIn() {
    errorMessage = "";
    successMessage = "";
    isGoogleLoading = true;

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(getEnvSetupMessage());
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getCallbackUrl(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
      // Browser navigates away on success
    } catch (err) {
      errorMessage = err?.message || "Google sign-in failed.";
      isGoogleLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Login · BendScript</title>
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover"
  />
</svelte:head>

<main class="login-page">
  <section class="card">
    <p class="eyebrow">BENDSCRIPT</p>
    <h1>Sign in to your workspace</h1>
    <p class="subtext">Continue with Google or get a magic link by email.</p>

    {#if !supabaseConfigured}
      <p class="status warning" role="alert">
        Supabase is not configured for this environment. Set
        <code>PUBLIC_SUPABASE_URL</code> and
        <code>PUBLIC_SUPABASE_ANON_KEY</code>, then restart the dev server.
      </p>
    {/if}

    <button
      class="btn btn-google"
      type="button"
      onclick={handleGoogleSignIn}
      disabled={isGoogleLoading || isEmailLoading || !supabaseConfigured}
    >
      {#if isGoogleLoading}
        Connecting to Google…
      {:else}
        Continue with Google
      {/if}
    </button>

    <div class="divider" aria-hidden="true">
      <span>or</span>
    </div>

    <form onsubmit={handleEmailSignIn}>
      <label for="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        bind:value={email}
        placeholder="you@company.com"
        required
        disabled={isEmailLoading || isGoogleLoading || !supabaseConfigured}
      />

      <button
        class="btn btn-primary"
        type="submit"
        disabled={isEmailLoading || isGoogleLoading || !supabaseConfigured}
      >
        {#if isEmailLoading}
          Sending magic link…
        {:else}
          Send magic link
        {/if}
      </button>
    </form>

    {#if errorMessage}
      <p class="status error" role="alert">{errorMessage}</p>
    {/if}

    {#if successMessage}
      <p class="status success">{successMessage}</p>
    {/if}

    <p class="helper">
      After signing in, you’ll be redirected to:
      <code>{redirectTo}</code>
    </p>
  </section>
</main>

<style>
  .login-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    padding: 1rem;
  }

  .card {
    width: min(460px, 100%);
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
    padding: 1.2rem;
  }

  .eyebrow {
    margin: 0 0 0.45rem;
    font:
      700 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    letter-spacing: 0.1em;
    color: #64748b;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.3rem, 2.5vw, 1.65rem);
    line-height: 1.2;
    color: #0f172a;
  }

  .subtext {
    margin: 0.5rem 0 1rem;
    color: #475569;
    font-size: 0.95rem;
  }

  form {
    display: grid;
    gap: 0.6rem;
  }

  label {
    font-size: 0.84rem;
    font-weight: 600;
    color: #334155;
  }

  input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 11px;
    background: #fff;
    color: #0f172a;
    padding: 0.68rem 0.78rem;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  input:focus {
    border-color: #6366f1;
  }

  .btn {
    width: 100%;
    border-radius: 11px;
    border: 1px solid transparent;
    padding: 0.7rem 0.9rem;
    font-weight: 600;
    font-size: 0.92rem;
    cursor: pointer;
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: white;
  }

  .btn-google {
    background: white;
    border-color: #d1d5db;
    color: #111827;
  }

  .divider {
    margin: 0.85rem 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.7rem;
    color: #64748b;
    font-size: 0.8rem;
  }

  .divider::before,
  .divider::after {
    content: "";
    height: 1px;
    background: #e2e8f0;
  }

  .status {
    margin: 0.75rem 0 0;
    border-radius: 10px;
    padding: 0.62rem 0.7rem;
    font-size: 0.86rem;
  }

  .status.error {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #7f1d1d;
  }

  .status.success {
    border: 1px solid #bbf7d0;
    background: #f0fdf4;
    color: #14532d;
  }

  .status.warning {
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #9a3412;
  }

  .helper {
    margin: 0.85rem 0 0;
    color: #64748b;
    font-size: 0.79rem;
  }

  code {
    background: #f1f5f9;
    color: #0f172a;
    border-radius: 6px;
    padding: 0.12rem 0.38rem;
    font:
      600 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }
</style>
