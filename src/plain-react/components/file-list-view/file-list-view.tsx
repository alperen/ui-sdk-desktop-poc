import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { clamp } from "../../hooks/use-gesture";
import {
  createListController,
  type ListLayout,
} from "../../primitives/list/list";
import {
  FileList,
  FileListItem,
  FileListLasso,
} from "../../primitives/list/file-list-parts";
import type { FileEntry } from "../../models/file-entry";
import { findTypeaheadMatch } from "../../primitives/list/find-typeahead-match";

export type MenuAction =
  | { type: "open"; id: string }
  | { type: "open-all"; ids: string[] };
type Props = {
  label?: string;
  items: FileEntry[];
  active: boolean;
  onActivate?: () => void;
  controller?: ReturnType<typeof createListController>;
  selectOnNavigation?: boolean;
  onOpen: (id: string, details?: { reason: "item-press" }) => void;
  onMenuAction: (action: MenuAction) => void;
  onCurrentItemChange?: (id: string | null) => void;
  renderItem: (item: FileEntry) => ReactNode;
} & (
  | {
      layout: "spatial";
      defaultPositions: Record<string, { x: number; y: number }>;
    }
  | { layout: Exclude<ListLayout, "spatial">; defaultPositions?: never }
);

export function FileListView({
  label = "Files",
  items,
  active,
  onActivate,
  controller: supplied,
  selectOnNavigation,
  onOpen,
  onMenuAction,
  onCurrentItemChange,
  renderItem,
  layout,
  defaultPositions,
}: Props) {
  const [own] = useState(createListController);
  const controller = supplied ?? own;
  const description = useId();
  const [count, setCount] = useState(0);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    target: HTMLElement;
  } | null>(null);
  useEffect(() => {
    if (active && document.activeElement === document.body)
      controller.focusItem();
  }, [active, controller]);

  function close() {
    setMenu(null);
    menu?.target.focus({ preventScroll: true });
  }

  function action(name: string) {
    const ids = items
      .filter((item) => controller.getSelectedIds().includes(item.id))
      .map((item) => item.id);
    if (name === "rename" && ids.length !== 1) return;
    close();
    if (name === "rename") controller.editSelected();
    else if (ids.length === 1) onMenuAction({ type: "open", id: ids[0] });
    else if (ids.length > 1) onMenuAction({ type: "open-all", ids });
  }
  return (
    <>
      <FileList
        className={`file-list ${layout}`}
        aria-label={label}
        aria-describedby={!items.length ? description : undefined}
        layout={layout}
        active={active}
        defaultPositions={layout === "spatial" ? defaultPositions : {}}
        controller={controller}
        selectOnNavigation={selectOnNavigation}
        onActivate={onOpen}
        onPointerDownCapture={onActivate}
        onFocusCapture={onActivate}
        onSelectedIdsChange={(ids) => {
          setCount(ids.length);
          onCurrentItemChange?.(ids.length === 1 ? ids[0] : null);
        }}
      >
        {items.map((entry) => (
          <FileListItem
            key={entry.id}
            className={`desktop-item ${layout === "vertical" ? "row" : "tile"}`}
            value={entry.id}
            label={entry.name}
            onDoubleClick={() => onOpen(entry.id, { reason: "item-press" })}
            onContextMenu={(event) => {
              event.preventDefault();
              controller.selectIfUnselected(entry.id);
              event.currentTarget.focus({ preventScroll: true });
              setMenu({
                x: event.clientX,
                y: event.clientY,
                target: event.currentTarget,
              });
            }}
          >
            {renderItem(entry)}
          </FileListItem>
        ))}
        {!items.length && (
          <p id={description} className="empty-message">
            No files here.
          </p>
        )}
        <FileListLasso />
      </FileList>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          count={count}
          onClose={close}
          onDismiss={() => setMenu(null)}
          onAction={action}
        />
      )}
    </>
  );
}

function ContextMenu({
  x,
  y,
  count,
  onClose,
  onDismiss,
  onAction,
}: {
  x: number;
  y: number;
  count: number;
  onClose: () => void;
  onDismiss: () => void;
  onAction: (name: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if ("showPopover" in el) el.showPopover();
    const box = el.getBoundingClientRect();
    el.style.left = `${clamp(x, 8, window.innerWidth - box.width - 8)}px`;
    const top =
      y + 4 + box.height <= window.innerHeight - 8 ? y + 4 : y - 4 - box.height;
    el.style.top = `${clamp(top, 8, window.innerHeight - box.height - 8)}px`;
    el.focus();
  }, [x, y]);
  useEffect(() => {
    function outside(event: Event) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        onDismiss();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [onDismiss]);
  return createPortal(
    <div
      ref={root}
      role="menu"
      aria-label="File actions"
      tabIndex={-1}
      popover="manual"
      className="file-actions"
      style={{ position: "fixed", left: x, top: y }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "Tab") {
          onClose();
          return;
        }
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        let next = index;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
        if (event.key === "ArrowUp")
          next =
            index < 0
              ? buttons.length - 1
              : (index + buttons.length - 1) % buttons.length;
        if (next !== index) {
          event.preventDefault();
          buttons[next].focus();
          search.current.text = "";
          return;
        }
        if (
          event.key.length !== 1 ||
          event.key === " " ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.nativeEvent.isComposing
        )
          return;
        event.preventDefault();
        const now = performance.now();
        const text =
          (now - search.current.at < 500 ? search.current.text : "") +
          event.key.toLocaleLowerCase();
        search.current = { text, at: now };
        const ordered = [
          ...buttons.slice(index + 1),
          ...buttons.slice(0, index + 1),
        ];
        findTypeaheadMatch(
          ordered,
          text,
          (button) => button.textContent?.trim() ?? "",
        )?.focus();
      }}
    >
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onPointerMove={(event) => event.currentTarget.focus()}
        onClick={() => onAction("open")}
      >
        {count > 1 ? `Open (${count})` : "Open"}
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-disabled={count !== 1 ? true : undefined}
        onPointerMove={(event) => event.currentTarget.focus()}
        onClick={() => onAction("rename")}
      >
        Rename
      </button>
    </div>,
    document.body,
  );
}
