import { createAgent, registerTools } from "@ui-sdk/react/agent";

declare global {
  interface Window {
    agent: ReturnType<typeof createAgent>;
  }
}

export const agent = createAgent();
window.agent = agent;

const unregister = registerTools(agent, { allow: (step) => !step.confirm });

if (import.meta.hot) {
  import.meta.hot.dispose(unregister);
}
