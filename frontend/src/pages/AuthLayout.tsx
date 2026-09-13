import type { ReactNode } from "react";

import { ThemeToggle } from "../components/ThemeToggle";

/** Shared shell for the signed-out screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth">
      <div className="auth__toggle">
        <ThemeToggle />
      </div>

      <div className="auth__card">
        <div className="auth__brand">
          <span className="auth__mark" aria-hidden="true" />
          <span className="auth__wordmark">Diagram Copilot</span>
        </div>

        <h1 className="auth__title">{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>

        {children}

        <p className="auth__footer">{footer}</p>
      </div>
    </div>
  );
}
