import { ReactFlowProvider } from "@xyflow/react";

import { Canvas } from "../components/Canvas";
import { Copilot } from "../components/Copilot";
import { SettingsModal } from "../components/SettingsModal";
import { StatusBar } from "../components/StatusBar";
import { TemplateRail } from "../components/TemplateRail";
import { TopBar } from "../components/TopBar";
import { useDiagram } from "../store/useDiagram";

/** The editor itself — what App used to render directly, now behind auth. */
export default function Studio() {
  const error = useDiagram((s) => s.error);
  const clearError = useDiagram((s) => s.clearError);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col overflow-hidden bg-surface">
        <TopBar />
        <div className="grid min-h-0 flex-1 grid-cols-[var(--rail)_minmax(0,1fr)_var(--panel)] max-[1240px]:grid-cols-[var(--rail)_minmax(0,1fr)] max-[900px]:grid-cols-[minmax(0,1fr)]">
          <TemplateRail />
          <main className="relative min-w-0 overflow-hidden bg-paper" aria-label="Diagram canvas">
            <Canvas />
          </main>
          <Copilot />
        </div>
        <StatusBar />
        {error && (
          <div className="banner" role="alert">
            <span>{error}</span>
            <button onClick={clearError}>Dismiss</button>
          </div>
        )}
        <SettingsModal />
      </div>
    </ReactFlowProvider>
  );
}