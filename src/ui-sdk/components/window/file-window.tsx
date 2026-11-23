import type { MovePoint } from "@ui-sdk/core";
import { Button } from "@ui-sdk/react/button";
import { Copy, Square, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { FileEntry } from "../../models/file-entry";
import type { WindowResizeDirection } from "../../primitives/window/window";
import {
  WindowContent,
  WindowHandle,
  WindowMaximize,
  WindowResizeHandle,
  WindowRoot,
} from "../../primitives/window/window-parts";
import { type FolderView, ViewLayoutControl } from "./view-layout-control";

const resizeHandles: {
  direction: WindowResizeDirection;
  name: string;
  position: string;
}[] = [
  { direction: "nw", name: "top left", position: "left-0 top-0 size-4" },
  { direction: "ne", name: "top right", position: "right-0 top-0 size-4" },
  { direction: "sw", name: "bottom left", position: "left-0 bottom-0 size-4" },
  {
    direction: "se",
    name: "bottom right",
    position: "right-0 bottom-0 size-4",
  },
  { direction: "n", name: "top", position: "inset-x-4 top-0 h-2" },
  { direction: "e", name: "right", position: "inset-y-4 right-0 w-2" },
  { direction: "s", name: "bottom", position: "inset-x-4 bottom-0 h-2" },
  { direction: "w", name: "left", position: "inset-y-4 left-0 w-2" },
];

interface FileWindowProps {
  view: FolderView;
  onViewChange: (view: FolderView) => void;
  entry: FileEntry;
  children?: ReactNode;
  attention: number;
  active: boolean;
  zIndex: number;
  onActivate: (id: string) => void;
  defaultPosition: MovePoint;
  onClose: (id: string) => void;
}

function focusContent(element: HTMLElement) {
  const target =
    element.querySelector<HTMLElement>('[role="listbox"] [tabindex="0"]') ??
    element.querySelector<HTMLElement>('[role="listbox"]') ??
    element;
  target.focus({ preventScroll: true });
}

export function FileWindow({
  view,
  onViewChange,
  entry,
  children,
  attention,
  active,
  zIndex,
  onActivate,
  defaultPosition,
  onClose,
}: FileWindowProps) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!attention || !element) return;

    focusContent(element);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const primary = "var(--primary)";
    const border = "var(--border)";
    const colors = reducedMotion
      ? [primary, primary]
      : [border, primary, border];

    const animation = element.animate(
      { borderColor: colors },
      { duration: 700, easing: "ease-in-out" },
    );

    return () => animation.cancel();
  }, [attention]);

  useEffect(() => {
    const element = root.current;
    if (!active || !element || element.contains(document.activeElement)) return;

    focusContent(element);
  }, [active]);

  function handleActivate() {
    onActivate(entry.id);
  }

  function handleClose() {
    onClose(entry.id);
  }

  return (
    <WindowRoot
      ref={root}
      active={active}
      zIndex={zIndex}
      onActivate={handleActivate}
      label={entry.name}
      aria-label={entry.name}
      defaultPosition={defaultPosition}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg outline-none data-active:shadow-xl data-maximized:rounded-none"
    >
      <div className="flex shrink-0 items-center border-b border-border bg-background">
        <WindowHandle
          aria-label={`Move ${entry.name}. Use Alt and arrow keys.`}
          className="block min-w-0 flex-1 truncate cursor-grab touch-none select-none px-4 py-3 text-left font-semibold outline-primary [-webkit-user-select:none] group-data-dragging:cursor-grabbing group-data-maximized:cursor-default"
        >
          {entry.name}
        </WindowHandle>
        {entry.kind === "directory" && (
          <ViewLayoutControl
            label={`${entry.name} view layout`}
            layout={view}
            onChange={onViewChange}
          />
        )}
        <WindowMaximize className="window-control">
          <Square
            aria-hidden="true"
            size={16}
            strokeWidth={2}
            absoluteStrokeWidth
            className="window-control-icon window-maximize-icon"
          />
          <Copy
            aria-hidden="true"
            size={16}
            strokeWidth={2}
            absoluteStrokeWidth
            className="window-control-icon window-restore-icon"
          />
        </WindowMaximize>
        <Button
          aria-label={`Close ${entry.name}`}
          onClick={handleClose}
          className="window-control mr-2"
        >
          <X aria-hidden="true" size={16} strokeWidth={2} absoluteStrokeWidth />
        </Button>
      </div>
      <WindowContent className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {children ?? (
          <p className="p-4">This window belongs to {entry.name}.</p>
        )}
      </WindowContent>
      {resizeHandles.map(({ direction, name, position }) => (
        <WindowResizeHandle
          key={direction}
          id={`${entry.id}-${direction}`}
          direction={direction}
          aria-label={`Resize ${entry.name} ${name}. Use arrow keys.`}
          className={`absolute rounded-sm focus-visible:bg-primary/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${position}`}
        />
      ))}
    </WindowRoot>
  );
}
