import { ReactFlowProvider } from "@xyflow/react";

import { Canvas } from "../components/Canvas";
import { Copilot } from "../components/Copilot";
import { SettingsModal } from "../components/SettingsModal";
import { StatusBar } from "../components/StatusBar";
import { TemplateRail } from "../components/TemplateRail";
import { TopBar } from "../components/TopBar";
import { UserChip } from "../components/UserChip";
import { useDiagram } from "../store/useDiagram";

/** The editor itself — what App used to render directly, now behind auth. */
export default function Studio() {
  const error = useDiagram((s) => s.error);
  const clearError = useDiagram((s) => s.clearError);

  return (
    <ReactFlowProvider>
      <div className="app">
        <TopBar />
        <div className="app__body">
          <TemplateRail />
          <main className="stage" aria-label="Diagram canvas">
            <Canvas />
            <UserChip />
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