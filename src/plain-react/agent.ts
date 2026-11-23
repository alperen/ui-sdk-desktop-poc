import { useEffect } from "react";
import { flushSync } from "react-dom";

type Entry = {
  component: string;
  label: string;
  actions: Record<string, (...args: never[]) => unknown>;
  items?: { value: string; label: string }[];
};
const entries = new Map<HTMLElement, Entry>();

export function useAgent(
  element: React.RefObject<HTMLElement | null>,
  entry: Entry,
) {
  useEffect(() => {
    const el = element.current;
    if (!el) return;

    entries.set(el, entry);
    return () => {
      entries.delete(el);
    };
  });
}

export function createAgent() {
  return {
    snapshot: () =>
      [...entries]
        .filter(([el]) => el.isConnected)
        .map(([, entry]) => ({
          ...entry,
          ref: entry.label,
          offPage: false,
          actions: Object.keys(entry.actions),
        })),
    act: async ({
      steps,
    }: {
      steps: {
        ref: string;
        action: string;
        args?: unknown[];
        confirm?: boolean;
      }[];
    }) => {
      for (const step of steps) {
        if (step.confirm)
          return { ok: false, error: { message: "Confirmation required" } };

        const entry = [...entries].find(
          ([el, entry]) => el.isConnected && entry.label === step.ref,
        )?.[1];
        const action = entry?.actions[step.action];
        if (!action)
          return { ok: false, error: { message: "Unknown target or action" } };

        flushSync(() => {
          action(...((step.args ?? []) as never[]));
        });
      }
      return { ok: true, error: undefined };
    },
  };
}
