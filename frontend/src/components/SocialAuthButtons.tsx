import { useEffect, useRef } from "react";

import type { TelegramAuthPayload } from "../api/types";
import { beginOAuthRedirect } from "../lib/oauth";
import { useAuth } from "../store/useAuth";
import { GithubIcon, GoogleIcon } from "./icons";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

const BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-[550] text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-45";

/** The "or continue with" block shared by Login and Register — signing in
 *  and signing up through a provider hit the exact same backend call
 *  either way, so there's nothing page-specific here.
 *
 * Google and GitHub are this app's own hand-styled buttons (a redirect
 * they kick off — see lib/oauth.ts). Telegram has no such button to style:
 * its Login Widget renders *its own* button as an iframe, only loaded when
 * VITE_TELEGRAM_BOT_USERNAME is set, and calls back into `onTelegramAuth`. */
export function SocialAuthButtons() {
  const busy = useAuth((s) => s.busy);
  const loginTelegram = useAuth((s) => s.loginTelegram);
  const widgetHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !widgetHost.current) return;
    window.onTelegramAuth = (user) => void loginTelegram(user);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "9");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    widgetHost.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [loginTelegram]);

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

      {/* Telegram's own iframe button lands here once the widget script
          loads — sized/rounded via the data-* attributes above, but its
          colors aren't ours to set, so it won't match the two buttons
          above exactly. That's the platform, not a bug. */}
      {TELEGRAM_BOT_USERNAME && <div className="flex justify-center pt-0.5" ref={widgetHost} />}
    </div>
  );
}
