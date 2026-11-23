import { useRef, useState } from "react";
import type { FileEntry } from "../models/file-entry";

type OpenWindow = { id: string; attention: number; zIndex: number };

export function useWindows(items: FileEntry[]) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const current = useRef(windows);
  const [activeWindowId, setActive] = useState<string | null>(null);

  function update(next: OpenWindow[]) {
    current.current = next;
    setWindows(next);
  }

  function openWindow(id: string) {
    if (!items.some((entry) => entry.id === id)) return;

    const zIndex =
      Math.max(0, ...current.current.map((entry) => entry.zIndex)) + 1;
    const existing = current.current.some((entry) => entry.id === id);
    update(
      existing
        ? current.current.map((entry) =>
            entry.id === id
              ? { ...entry, zIndex, attention: entry.attention + 1 }
              : entry,
          )
        : [...current.current, { id, attention: 0, zIndex }],
    );
    setActive(id);
  }

  function openWindows(ids: string[]) {
    ids.forEach(openWindow);
  }

  function focusWindow(id: string | null) {
    if (id !== null && !current.current.some((entry) => entry.id === id))
      return;

    setActive(id);
    const top = Math.max(0, ...current.current.map((entry) => entry.zIndex));
    const entry = current.current.find((entry) => entry.id === id);
    if (!entry || entry.zIndex === top) return;

    update(
      current.current.map((entry) =>
        entry.id === id ? { ...entry, zIndex: top + 1 } : entry,
      ),
    );
  }

  function closeWindow(id: string) {
    const remaining = current.current.filter((entry) => entry.id !== id);
    update(remaining);
    const top = remaining.reduce<OpenWindow | undefined>(
      (best, entry) => (!best || best.zIndex < entry.zIndex ? entry : best),
      undefined,
    );
    setActive((active) => (active === id ? (top?.id ?? null) : active));
  }
  return {
    windows,
    activeWindowId,
    openWindow,
    openWindows,
    focusWindow,
    closeWindow,
  };
}
