import { useRef, useState } from "react";
import type { FileEntry } from "../models/file-entry";

interface WindowItem {
  id: string;
  attention: number;
  zIndex: number;
}

function maximumZIndex(windows: WindowItem[]) {
  return Math.max(0, ...windows.map((window) => window.zIndex));
}

export function useWindows(items: FileEntry[]) {
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const currentWindows = useRef(windows);

  function updateWindows(next: WindowItem[]) {
    currentWindows.current = next;
    setWindows(next);
  }

  function openWindow(id: string) {
    if (!items.some((item) => item.id === id)) return;

    const current = currentWindows.current;
    const zIndex = maximumZIndex(current) + 1;
    const isOpen = current.some((window) => window.id === id);
    const next = isOpen
      ? current.map((window) =>
          window.id === id
            ? { ...window, attention: window.attention + 1, zIndex }
            : window,
        )
      : [...current, { id, attention: 0, zIndex }];

    updateWindows(next);
    setActiveWindowId(id);
  }

  function openWindows(ids: string[]) {
    for (const id of ids) openWindow(id);
  }

  function focusWindow(id: string | null) {
    const current = currentWindows.current;
    const target = current.find((window) => window.id === id);
    if (id !== null && !target) return;

    setActiveWindowId(id);
    if (!target) return;

    const top = maximumZIndex(current);
    if (target.zIndex === top) return;

    updateWindows(
      current.map((window) =>
        window.id === id ? { ...window, zIndex: top + 1 } : window,
      ),
    );
  }

  function closeWindow(id: string) {
    const remaining = currentWindows.current.filter(
      (window) => window.id !== id,
    );
    const top = maximumZIndex(remaining);
    const nextActiveId =
      remaining.find((window) => window.zIndex === top)?.id ?? null;

    updateWindows(remaining);
    setActiveWindowId((current) => (current === id ? nextActiveId : current));
  }

  return {
    windows,
    activeWindowId,
    openWindow,
    openWindows,
    closeWindow,
    focusWindow,
  };
}
