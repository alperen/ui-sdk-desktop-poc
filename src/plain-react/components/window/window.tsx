import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAgent } from "../../agent";
import { ColumnView } from "../column-view/column-view";
import { FileListView, type MenuAction } from "../file-list-view/file-list-view";
import { clamp, useGesture } from "../../hooks/use-gesture";
import { ControlIcon } from "../control-icon/control-icon";
import { Item } from "../item/item";
import type { FileEntry } from "../../models/file-entry";
import { useFileList } from "../../contexts/file-list-context";
import {
  type FolderView,
  ViewLayoutControl,
} from "./view-layout-control";

type Box = { x: number; y: number; width: number; height: number };
type Direction = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
const handles: { direction: Direction; name: string }[] = [
  { direction: "nw", name: "top left" },
  { direction: "ne", name: "top right" },
  { direction: "sw", name: "bottom left" },
  { direction: "se", name: "bottom right" },
  { direction: "n", name: "top" },
  { direction: "e", name: "right" },
  { direction: "s", name: "bottom" },
  { direction: "w", name: "left" },
];

type Props = {
  item: FileEntry;
  attention: number;
  zIndex: number;
  active: boolean;
  defaultPosition: { x: number; y: number };
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onOpen: (id: string) => void;
  openWindows: (ids: string[]) => void;
};
export function Window({
  item,
  attention,
  zIndex,
  active,
  defaultPosition,
  onActivate,
  onClose,
  onOpen,
  openWindows,
}: Props) {
  const { items } = useFileList();
  const [view, setView] = useState<FolderView>("list");
  const [box, setBox] = useState<Box>({
    ...defaultPosition,
    width: 800,
    height: 360,
  });
  const [maximized, setMaximized] = useState(false);
  const [dragging, setDragging] = useState<Direction | null>(null);
  const root = useRef<HTMLElement>(null);
  const gesture = useGesture();

  const bounds = useCallback(() => {
    const parent = root.current?.parentElement;
    return {
      width: Math.floor((parent?.clientWidth ?? 800) / 4) * 4,
      height: Math.floor((parent?.clientHeight ?? 480) / 4) * 4,
    };
  }, []);
  function resize(
    start: Box,
    direction: Direction,
    dx: number,
    dy: number,
  ): Box {
    const limit = bounds();
    const minWidth = Math.min(240, limit.width),
      minHeight = Math.min(120, limit.height);
    if (direction === "move")
      return {
        ...start,
        x: clamp(start.x + dx, 0, limit.width - start.width),
        y: clamp(start.y + dy, 0, limit.height - start.height),
      };
    let left = start.x,
      right = start.x + start.width,
      top = start.y,
      bottom = start.y + start.height;
    if (direction.includes("w")) left = clamp(left + dx, 0, right - minWidth);
    if (direction.includes("e"))
      right = clamp(right + dx, left + minWidth, limit.width);
    if (direction.includes("n")) top = clamp(top + dy, 0, bottom - minHeight);
    if (direction.includes("s"))
      bottom = clamp(bottom + dy, top + minHeight, limit.height);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  useLayoutEffect(() => {
    const limit = bounds();
    setBox((current) => {
      const width = Math.min(current.width, limit.width),
        height = Math.min(current.height, limit.height);
      return {
        width,
        height,
        x: clamp(current.x, 0, limit.width - width),
        y: clamp(current.y, 0, limit.height - height),
      };
    });
  }, [bounds]);
  const focusContent = useCallback(() => {
    const element = root.current;
    const target =
      element?.querySelector<HTMLElement>('[role="listbox"] [tabindex="0"]') ??
      element?.querySelector<HTMLElement>('[role="listbox"]') ??
      element;
    const options = { preventScroll: true, focusVisible: false };
    target?.focus(options);
  }, []);
  useEffect(() => {
    if (
      active &&
      root.current &&
      !root.current.contains(document.activeElement)
    )
      focusContent();
  }, [active, focusContent]);
  useEffect(() => {
    const element = root.current;
    if (!attention || !element) return;
    focusContent();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = element.animate(
      {
        borderColor: reduced
          ? ["var(--primary)", "var(--primary)"]
          : ["var(--border)", "var(--primary)", "var(--border)"],
      },
      { duration: 700, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [attention, focusContent]);

  function down(
    event: React.PointerEvent<HTMLButtonElement>,
    direction: Direction,
  ) {
    if (event.button !== 0 || maximized) return;
    if (direction === "move" && event.target !== event.currentTarget) return;
    event.preventDefault();
    event.currentTarget.focus();
    const original = box;
    let changed = false;
    gesture(
      event,
      (dx, dy) => {
        if (!changed && Math.hypot(dx, dy) < 4) return;
        changed = true;
        setDragging(direction);
        setBox(
          resize(
            original,
            direction,
            Math.round(dx / 4) * 4,
            Math.round(dy / 4) * 4,
          ),
        );
      },
      (cancelled) => {
        setDragging(null);
        if (cancelled) setBox(original);
      },
    );
  }

  function key(event: React.KeyboardEvent, direction: Direction) {
    if (
      maximized ||
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (direction === "move" && !event.altKey) return;
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 4;
    setBox(resize(box, direction, offset[0] * step, offset[1] * step));
  }

  function toggle() {
    onActivate(item.id);
    setMaximized((current) => !current);
  }
  useAgent(root, {
    component: "window",
    label: item.name,
    actions: {
      moveTo: (point: { x: number; y: number }) => {
        if (
          maximized ||
          !Number.isFinite(point?.x) ||
          !Number.isFinite(point?.y)
        )
          return;
        setBox(resize(box, "move", point.x - box.x, point.y - box.y));
      },
      activate: () => onActivate(item.id),
      toggleMaximized: toggle,
    },
  });

  function menuAction(action: MenuAction) {
    if (action.type === "open") onOpen(action.id);
    else openWindows(action.ids);
  }
  return (
    <section
      ref={root}
      aria-label={item.name}
      tabIndex={-1}
      data-slot="window"
      data-active={active ? "" : undefined}
      data-maximized={maximized ? "" : undefined}
      data-dragging={dragging === "move" ? "" : undefined}
      data-resizing={dragging && dragging !== "move" ? "" : undefined}
      className="file-window"
      style={{
        zIndex,
        ...(maximized
          ? { left: 0, top: 0, width: "100%", height: "100%" }
          : { left: box.x, top: box.y, width: box.width, height: box.height }),
      }}
      onPointerDown={(event) => {
        if (event.button === 0) onActivate(item.id);
      }}
      onFocus={() => onActivate(item.id)}
    >
      <div className="window-bar">
        <button
          type="button"
          className="window-handle"
          aria-label={`Move ${item.name}. Use Alt and arrow keys.`}
          onPointerDown={(event) => down(event, "move")}
          onKeyDown={(event) => key(event, "move")}
          onDoubleClick={toggle}
        >
          {item.name}
        </button>
        {item.kind === "directory" && (
          <ViewLayoutControl
            label={`${item.name} view layout`}
            layout={view}
            onChange={setView}
          />
        )}
        <button
          type="button"
          className="window-control"
          aria-label={`${maximized ? "Restore" : "Maximize"} ${item.name}`}
          onClick={toggle}
        >
          <ControlIcon
            name="maximize"
            className="window-control-icon window-maximize-icon"
          />
          <ControlIcon
            name="restore"
            className="window-control-icon window-restore-icon"
          />
        </button>
        <button
          type="button"
          className="window-control close-control"
          aria-label={`Close ${item.name}`}
          onClick={() => onClose(item.id)}
        >
          <ControlIcon name="close" />
        </button>
      </div>
      <div className="window-content">
        {item.kind !== "directory" ? (
          <p className="window-message">This window belongs to {item.name}.</p>
        ) : view === "columns" ? (
          <ColumnView
            root={item}
            items={items}
            active={active}
            onOpen={onOpen}
            onMenuAction={menuAction}
          />
        ) : (
          <FileListView
            items={items.filter((entry) => entry.parentId === item.id)}
            layout={view === "grid" ? "grid" : "vertical"}
            label={`${item.name} contents`}
            active={active}
            onOpen={onOpen}
            onMenuAction={menuAction}
            renderItem={(entry) => (
              <Item entry={entry} compact={view !== "grid"} />
            )}
          />
        )}
      </div>
      {!maximized &&
        handles.map(({ direction, name }) => (
          <button
            type="button"
            key={direction}
            className={`resize-handle resize-${direction}`}
            aria-label={`Resize ${item.name} ${name}. Use arrow keys.`}
            onPointerDown={(event) => down(event, direction)}
            onKeyDown={(event) => key(event, direction)}
          />
        ))}
    </section>
  );
}
