import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  consumeOAuthState,
  oauthProviderLabel,
  oauthRedirectUri,
  type OAuthProvider,
} from "../lib/oauth";
import { useAuth } from "../store/useAuth";
import { AuthLayout } from "./AuthLayout";

function isOAuthProvider(value: string | undefined): value is OAuthProvider {
  return value === "google" || value === "github";
}

/** Where Google/GitHub redirect back to after the user approves (or denies)
 *  sign-in — one page for both, since the only thing that differs is which
 *  `useAuth` action and provider label to use. Exchanges the `code` for a
 *  session, then leaves for /templates (success) or /login (anything else,
 *  with the reason left in useAuth's `error` for Login.tsx to show). */
export default function AuthCallback() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginGoogle = useAuth((s) => s.loginGoogle);
  const loginGithub = useAuth((s) => s.loginGithub);
  // The provider's `code` is single-use — a second exchange attempt just
  // fails — so this guards against effects re-running (StrictMode, a
  // fast re-render) from burning it twice.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !isOAuthProvider(provider)) return;
    ran.current = true;
    // Narrowed by the guard above, but that narrowing doesn't carry into the
    // nested closure below — capture it in a variable that does.
    const activeProvider = provider;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const deniedReason = searchParams.get("error");
    const expectedState = consumeOAuthState();

    async function run() {
      if (deniedReason) {
        useAuth.setState({ error: `${oauthProviderLabel(activeProvider)} sign-in was cancelled.` });
        navigate("/login", { replace: true });
        return;
      }
      if (!code || !state || state !== expectedState) {
        useAuth.setState({ error: "That sign-in link is invalid or expired — try again." });
        navigate("/login", { replace: true });
        return;
      }
      const login = activeProvider === "google" ? loginGoogle : loginGithub;
      const ok = await login(code, oauthRedirectUri(activeProvider));
      navigate(ok ? "/templates" : "/login", { replace: true });
    }
    void run();
  }, [provider, searchParams, navigate, loginGoogle, loginGithub]);

  if (!isOAuthProvider(provider)) return <Navigate to="/login" replace />;

  return (
    <AuthLayout
      title="Signing you in…"
      subtitle={`Finishing sign-in with ${oauthProviderLabel(provider)}.`}
      footer={null}
    >
      <div className="flex items-center justify-center py-6">
        <span className="btn__spin" aria-hidden />
      </div>
    </AuthLayout>
  );
}
