import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../store/useAuth";
import { AuthLayout } from "./AuthLayout";

const MIN_PASSWORD = 8;

export default function Register() {
  const { user, busy, error, register, clearError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) return <Navigate to="/" replace />;

  // Checked here as well as server-side so the failure is immediate.
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tooShort) return;
    if (await register(email.trim(), name.trim(), password)) navigate("/", { replace: true });
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
      <form className="auth__form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError();
            }}
          />
        </label>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
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

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
          />
          <span className={`field__hint${tooShort ? " field__hint--warn" : ""}`}>
            At least {MIN_PASSWORD} characters.
          </span>
        </label>

        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}

        <button
          className="btn btn--accent btn--block"
          type="submit"
          disabled={busy || tooShort}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
