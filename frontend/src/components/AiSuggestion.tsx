import { useState } from "react";

import { useDiagram } from "../store/useDiagram";
import { Sparkles, X } from "./icons";

export function AiSuggestion() {
  const [dismissed, setDismissed] = useState(false);
  const autoLayout = useDiagram((s) => s.autoLayout);
  const hasNodes = useDiagram((s) => s.doc.nodes.length > 0);
  const busy = useDiagram((s) => s.busy);

  if (!hasNodes || dismissed) return null;

  return (
    <div
      className="absolute bottom-[52px] left-4 z-[8] flex max-w-[340px] animate-[menu-in_200ms_ease] items-center gap-2.5 rounded-[11px] border border-line bg-surface py-[9px] pl-3 pr-2.5 shadow-2"
      role="status"
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-green-soft text-green-strong [&_svg]:size-3.5">
        <Sparkles />
      </span>
      <div>
        <b className="mb-0.5 block text-[11px] font-[650] text-ink">AI Suggestion</b>
        <span className="block text-[11.5px] leading-[1.4] text-slate">
          Your diagram has a couple of crossing connectors. I can optimize the layout.
        </span>
      </div>
      <div className="ml-0.5 flex items-center gap-1">
        <button
          className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[7px] border border-green bg-green px-2.5 py-1 text-xs font-[550] text-on-accent transition-colors hover:border-green-strong hover:bg-green-strong disabled:cursor-not-allowed disabled:opacity-45"
          disabled={busy !== null}
          onClick={() => void autoLayout()}
        >
          Fix Layout
        </button>
        <button
          className="grid size-[22px] place-items-center rounded-md border-none bg-transparent p-1 text-slate-soft hover:bg-paper hover:text-ink [&_svg]:size-[13px]"
          aria-label="Dismiss suggestion"
          onClick={() => setDismissed(true)}
        >
          <X />
        </button>
      </div>
    </div>
  );
}