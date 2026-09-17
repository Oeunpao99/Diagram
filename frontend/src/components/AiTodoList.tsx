import { CheckCircle, CircleOutline } from "./icons";

export interface AiTodoStep {
  id: string;
  label: string;
  done: boolean;
}

/** The Copilot's live plan while the AI works — the full list of steps up
 *  front, each checked off as it genuinely finishes. Three row states: done
 *  (check), the first not-done row ("active" — a spinner), and everything
 *  after it ("pending" — an empty ring). Rows are keyed by id so a step
 *  already on screen never re-plays its entrance animation when a later one
 *  in the list completes. */
export function AiTodoList({ steps }: { steps: AiTodoStep[] }) {
  if (steps.length === 0) return null;
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <ul className="space-y-1">
      {steps.map((step, index) => {
        const status = step.done ? "done" : index === activeIndex ? "active" : "pending";
        return (
          <li
            key={step.id}
            className={`chat-in flex items-start gap-1.5 text-[12.5px] leading-[1.45] ${
              status === "pending" ? "text-slate-soft" : status === "done" ? "text-slate-soft" : "text-ink"
            }`}
            style={{ animationDelay: `${Math.min(index, 9) * 110}ms` }}
          >
            <span
              className={`mt-px grid size-3.5 shrink-0 place-items-center ${
                status === "done" ? "text-green-strong" : status === "active" ? "text-slate" : "text-line-strong"
              }`}
            >
              {status === "done" ? (
                <CheckCircle />
              ) : status === "active" ? (
                <span className="btn__spin" aria-hidden />
              ) : (
                <CircleOutline />
              )}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
