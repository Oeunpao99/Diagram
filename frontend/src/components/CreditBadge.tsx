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
      className={`inline-flex shrink-0 cursor-pointer items-center gap-[7px] rounded-[7px] border bg-surface font-[550] tabular-nums transition-colors hover:border-green ${
        low ? "border-brand-red text-brand-red" : "border-line text-ink hover:bg-surface-2"
      } ${size === "md" ? "px-3 py-2 text-[13px] [&_svg]:size-4" : "px-[11px] py-[7px] text-[12.5px] [&_svg]:size-[15px]"}`}
      onClick={() => openBilling("topup")}
      title={low ? "Running low — buy more credits" : "Buy more credits"}
      aria-label={`${credits} credits left. Buy more.`}
    >
      <Sparkles />
      {credits}
      <span className="text-slate">credits</span>
    </button>
  );
}
