import type { ReactNode } from "react";

import { LogoMark } from "../components/icons";
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
    <div className="relative grid min-h-screen place-items-center bg-paper px-4 py-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-8 shadow-2 max-[560px]:px-5 max-[560px]:py-6">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-[26px] place-items-center rounded-lg bg-[linear-gradient(135deg,var(--green),var(--green-deep))] text-on-accent [&_svg]:size-[15px]">
            <LogoMark />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-strong">
            Kumnous-គំនូស
          </span>
        </div>

        <h1 className="m-0 mb-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink-strong">
          {title}
        </h1>
        <p className="m-0 mb-6 text-[13px] text-slate">{subtitle}</p>

        {children}

        <p className="mt-5 text-center text-[13px] text-slate [&_a]:font-medium [&_a]:text-green [&_a]:no-underline [&_a:hover]:underline">
          {footer}
        </p>
      </div>
    </div>
  );
}
