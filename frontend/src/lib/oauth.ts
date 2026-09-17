import { useAuth } from "../store/useAuth";

export type OAuthProvider = "google" | "github";

const AUTHORIZE_URL: Record<OAuthProvider, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  github: "https://github.com/login/oauth/authorize",
};

const SCOPE: Record<OAuthProvider, string> = {
  google: "openid email profile",
  github: "read:user user:email",
};

const CLIENT_ID: Record<OAuthProvider, string | undefined> = {
  google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  github: import.meta.env.VITE_GITHUB_CLIENT_ID,
};

const LABEL: Record<OAuthProvider, string> = { google: "Google", github: "GitHub" };

// sessionStorage (not localStorage): the value only needs to survive the
// single round trip to the provider and back, in this tab.
const STATE_KEY = "dc.oauth-state";

/** Must match exactly what's registered as this provider's callback URL —
 *  see AuthCallback.tsx and each provider's app settings. */
export function oauthRedirectUri(provider: OAuthProvider): string {
  return `${window.location.origin}/auth/callback/${provider}`;
}

/** Sends the browser to `provider`'s consent screen. AuthCallback.tsx picks
 *  the flow back up once the provider redirects here with a `code`. A
 *  random `state`, stashed in sessionStorage first, is how that callback
 *  later confirms the response actually answers *this* redirect rather than
 *  a forged one (CSRF) — see consumeOAuthState. */
export function beginOAuthRedirect(provider: OAuthProvider) {
  const clientId = CLIENT_ID[provider];
  if (!clientId) {
    useAuth.setState({ error: `Sign-in with ${LABEL[provider]} isn't set up yet.` });
    return;
  }

  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    // Private window or blocked site data — the callback's state check
    // just fails closed below, the same as a genuine forged response would.
  }

  const url = new URL(AUTHORIZE_URL[provider]);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE[provider]);
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

/** Reads back (and clears) the `state` stashed before the redirect — call
 *  once, from AuthCallback.tsx, and compare it to the query string's own
 *  `state` before trusting anything else in the response. */
export function consumeOAuthState(): string | null {
  try {
    const value = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return value;
  } catch {
    return null;
  }
}

export function oauthProviderLabel(provider: OAuthProvider): string {
  return LABEL[provider];
}
