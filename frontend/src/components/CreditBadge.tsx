import { useAuth } from "../store/useAuth";
import { useBilling } from "../store/useBilling";
import { Sparkles } from "./icons";

/** Below this, the badge turns red as a nudge to top up before a run fails. */
const LOW = 5;

/** The credit balance, as a button that opens the top-up dialog. */
export function CreditBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const credits = useAuth((s) => s.user?.credits);
  const openBilling = useBilling((s) => s.openBilling);

  if (credits === undefined) return null;
  const low = credits < LOW;

  return (
    <button
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-surface font-semibold transition-colors hover:border-green ${
        low ? "border-brand-red text-brand-red" : "border-line-strong text-ink-strong"
      } ${size === "md" ? "px-3 py-2 text-[13px] [&_svg]:size-4" : "px-2.5 py-1.5 text-[12px] [&_svg]:size-3.5"}`}
      onClick={() => openBilling("topup")}
      title={low ? "Running low — buy more credits" : "Buy more credits"}
      aria-label={`${credits} credits left. Buy more.`}
    >
      <Sparkles />
      {credits}
      <span className="font-normal text-slate">credits</span>
    </button>
  );
}
