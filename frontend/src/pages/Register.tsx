import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { PasswordField } from "../components/PasswordField";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { useAuth } from "../store/useAuth";
import { AuthLayout } from "./AuthLayout";

const MIN_PASSWORD = 8;

export default function Register() {
  const { user, busy, error, register, clearError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) return <Navigate to="/templates" replace />;

  // Checked here as well as server-side so the failure is immediate.
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tooShort) return;
    if (await register(email.trim(), name.trim(), password)) navigate("/templates", { replace: true });
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Diagrams you make are private to you."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate">Name</span>
          <input
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError();
            }}
          />
        </label>

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
          autoComplete="new-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearError();
          }}
          hint={
            <span className={`text-[11px] ${tooShort ? "text-amber" : "text-slate-soft"}`}>
              At least {MIN_PASSWORD} characters.
            </span>
          }
        />

        {error && (
          <p className="m-0 rounded-md bg-red-soft px-3 py-[9px] text-[13px] text-red" role="alert">
            {error}
          </p>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-[7px] whitespace-nowrap rounded-md border border-green bg-green px-3 py-1.5 text-[12.5px] font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          type="submit"
          disabled={busy || tooShort}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <SocialAuthButtons />
    </AuthLayout>
  );
}
