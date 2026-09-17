import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { PasswordField } from "../components/PasswordField";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { useAuth } from "../store/useAuth";
import { AuthLayout } from "./AuthLayout";

export default function Login() {
  const { user, busy, error, login, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Bounce straight through if a session is already live.
  if (user) return <Navigate to="/templates" replace />;

  // "from" only exists when a protected route redirected here — go back to
  // whatever the user was actually trying to reach. Otherwise (following a
  // plain login link) land on the dashboard, not straight into the editor.
  const from = (location.state as { from?: string } | null)?.from ?? "/templates";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await login(email.trim(), password)) navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to reach your diagrams."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate">Email</span>
          <input
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
          />
        </label>

        <PasswordField
          autoComplete="current-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearError();
          }}
        />

        {error && (
          <p className="m-0 rounded-md bg-red-soft px-3 py-[9px] text-[13px] text-red" role="alert">
            {error}
          </p>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          type="submit"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <SocialAuthButtons />
    </AuthLayout>
  );
}
