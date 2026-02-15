import React from "react";
import { createRoot } from "react-dom/client";
import PomodoroOverhaul from "./src/pomodoro/PomodoroOverhaul";

(function mountStandalonePomodoro() {
  const panel = document.getElementById("panel-pomodoro");
  if (!panel) return;

  panel.innerHTML = "";
  const rootEl = document.createElement("div");
  rootEl.id = "pomodoro-react-root";
  panel.appendChild(rootEl);

  createRoot(rootEl).render(
    <React.StrictMode>
      <PomodoroOverhaul />
    </React.StrictMode>
  );
})();
