import { useState, type ReactNode } from "react";

import { Eye, EyeOff } from "./icons";

/** A password input with a show/hide toggle — shared by Login and Register
 *  so the same eye-icon behavior (and its a11y label) lives in one place. */
export function PasswordField({
  value,
  onChange,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate">Password</span>
      <div className="relative">
        <input
          className="w-full rounded-md border border-line-strong bg-surface px-3 py-[9px] pr-9 text-sm text-ink transition-[border-color,box-shadow] outline-none focus:border-green focus:shadow-[0_0_0_3px_var(--green-ring)]"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-slate-soft transition-colors hover:text-ink [&_svg]:size-[15px]"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint}
    </label>
  );
}
