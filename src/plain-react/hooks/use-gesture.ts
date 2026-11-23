import { useEffect, useRef } from "react";

// Document listeners survive focus changes and handles disappearing during a gesture.
export function useGesture() {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return (
    start: React.PointerEvent,
    move: (x: number, y: number) => void,
    finish: (cancelled: boolean) => void,
  ) => {
    cleanup.current?.();
    const pointerId = start.pointerId;
    let ended = false;

    function end(cancelled: boolean) {
      if (ended) return;
      ended = true;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey, true);
      cleanup.current = null;
      finish(cancelled);
    }
    function onMove(event: PointerEvent) {
      if (event.pointerId === pointerId)
        move(event.clientX - start.clientX, event.clientY - start.clientY);
    }
    function onUp(event: PointerEvent) {
      if (event.pointerId === pointerId) end(false);
    }
    function onCancel(event: PointerEvent) {
      if (event.pointerId === pointerId) end(true);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      end(true);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey, true);
    cleanup.current = () => end(true);
  };
}

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));
