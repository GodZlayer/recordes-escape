import { prepareDesignEditor } from "@canva/intents/design";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

async function render() {
  createRoot(document.getElementById("root") as Element).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

prepareDesignEditor({ render });
