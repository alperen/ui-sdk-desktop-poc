import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createAgent } from "./agent";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
Object.assign(window, { agent: createAgent() });
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
