import { useAuth } from "../store/useAuth";
import { beginOAuthRedirect } from "../lib/oauth";
import { GithubIcon, GoogleIcon } from "./icons";

const BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-[550] text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-45";

/** The "or continue with" block shared by Login and Register — signing in
 *  and signing up through a provider hit the exact same backend call
 *  either way, so there's nothing page-specific here.
 *
 * Google and GitHub are this app's own hand-styled buttons (a redirect
 * they kick off — see lib/oauth.ts). */
export function SocialAuthButtons() {
  const busy = useAuth((s) => s.busy);

  return (
    <div className="mt-1 flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[11px] font-medium text-slate-soft">
        <span className="h-px flex-1 bg-line" />
        or continue with
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={busy}
          onClick={() => beginOAuthRedirect("google")}
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={busy}
          onClick={() => beginOAuthRedirect("github")}
        >
          <GithubIcon />
          Continue with GitHub
        </button>
      </div>
    </div>
  );
}
