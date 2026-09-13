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
    <div className="ai-suggest" role="status">
      <span className="ai-suggest__spark">
        <Sparkles />
      </span>
      <div className="ai-suggest__text">
        <b>AI Suggestion</b>
        <span>Your diagram has a couple of crossing connectors. I can optimize the layout.</span>
      </div>
      <div className="ai-suggest__actions">
        <button
          className="btn btn--sm btn--accent"
          disabled={busy !== null}
          onClick={() => void autoLayout()}
        >
          Fix Layout
        </button>
        <button
          className="ai-suggest__close"
          aria-label="Dismiss suggestion"
          onClick={() => setDismissed(true)}
        >
          <X />
        </button>
      </div>
    </div>
  );
}