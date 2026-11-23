import {
  createContext,
  type HTMLAttributes,
  type PointerEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAgent } from "../../agent";
import { clamp, useGesture } from "../../hooks/use-gesture";
import { ItemEditContext } from "../../contexts/item-edit-context";
import { findTypeaheadMatch } from "./find-typeahead-match";
import type { createListController, ListLayout } from "./list";

type Point = { x: number; y: number };
type Registered = {
  el: HTMLDivElement;
  label: string;
  edit: React.RefObject<(() => void) | null>;
};
type ListAPI = {
  register: (id: string, entry: Registered | null) => void;
  selected: string[];
  focused: string | null;
  positions: Record<string, Point>;
  layout: ListLayout;
  press: (id: string, event: React.MouseEvent) => void;
  down: (id: string, event: PointerEvent) => void;
  key: (id: string, event: React.KeyboardEvent) => void;
  remember: (id: string) => void;
  lasso: {
    x: number;
    y: number;
    width: number;
    height: number;
    touched: string[];
  } | null;
};
const ListContext = createContext<ListAPI | null>(null);
function useList() {
  const list = useContext(ListContext);
  if (!list) throw new Error("Missing FileList");
  return list;
}
type Props = Omit<HTMLAttributes<HTMLDivElement>, "onActivate"> & {
  layout: ListLayout;
  active: boolean;
  defaultPositions: Record<string, Point>;
  controller?: ReturnType<typeof createListController>;
  selectOnNavigation?: boolean;
  onActivate?: (id: string, details: { reason: "item-press" }) => void;
  onSelectedIdsChange?: (ids: string[]) => void;
};

export function FileList({
  children,
  layout,
  active,
  defaultPositions,
  controller,
  selectOnNavigation,
  onActivate,
  onSelectedIdsChange,
  ...props
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const entries = useRef(new Map<string, Registered>());
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected);
  const [focused, setFocused] = useState<string | null>(null);
  const focusRef = useRef<string | null>(null);
  const anchor = useRef<string | null>(null);
  const [positions, setPositions] = useState(defaultPositions);
  const [lasso, setLasso] = useState<ListAPI["lasso"]>(null);
  const gesture = useGesture();
  const suppressClick = useRef(false);
  const search = useRef({ text: "", at: 0 });

  function keys() {
    return [...entries.current.keys()];
  }

  function select(ids: string[]) {
    selectedRef.current = ids;
    setSelected(ids);
    onSelectedIdsChange?.(ids);
  }

  function focus(id?: string, choose = false) {
    const key = id ?? focusRef.current ?? keys()[0];
    const target = entries.current.get(key);
    if (!target) {
      root.current?.focus();
      return;
    }

    focusRef.current = key;
    setFocused(key);
    target.el.focus({ preventScroll: true });
    target.el.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (choose) {
      anchor.current = key;
      select([key]);
    }
  }

  function editSelected() {
    if (selectedRef.current.length !== 1) return;
    search.current.text = "";
    const entry = entries.current.get(selectedRef.current[0]);
    // Restore the selected option even if another option owned focus.
    entry?.el.focus({ preventScroll: true });
    entry?.edit.current?.();
  }

  function selectIfUnselected(id: string) {
    if (!entries.current.has(id)) return selectedRef.current;
    if (!selectedRef.current.includes(id)) {
      anchor.current = id;
      select([id]);
    }
    return selectedRef.current;
  }

  function range(id: string, from: string) {
    const ordered = keys();
    const a = ordered.indexOf(from);
    const b = ordered.indexOf(id);
    select(ordered.slice(Math.min(a, b), Math.max(a, b) + 1));
  }

  function press(id: string, event: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    search.current.text = "";
    if (event.shiftKey) range(id, anchor.current ?? focusRef.current ?? id);
    else if (event.metaKey || event.ctrlKey) {
      anchor.current = id;
      select(
        selectedRef.current.includes(id)
          ? selectedRef.current.filter((key) => key !== id)
          : [...selectedRef.current, id],
      );
    } else {
      anchor.current = id;
      select([id]);
    }
    focus(id);
  }

  function down(id: string, event: PointerEvent) {
    if (event.button !== 0) return;
    suppressClick.current = false;
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey)
      selectIfUnselected(id);
    entries.current.get(id)?.el.focus({ preventScroll: true });
    if (layout !== "spatial" || !positions[id]) return;

    const group = selectedRef.current.includes(id) ? selectedRef.current : [id];
    const bounds = root.current;
    if (!bounds) return;
    const copies: HTMLElement[] = [];
    let delta = { x: 0, y: 0 };
    let moving = false;
    let minX = -Infinity,
      maxX = Infinity,
      minY = -Infinity,
      maxY = Infinity;
    for (const key of group) {
      const entry = entries.current.get(key);
      const at = positions[key];
      if (!entry || !at) continue;
      minX = Math.max(minX, -at.x);
      minY = Math.max(minY, -at.y);
      maxX = Math.min(maxX, bounds.clientWidth - entry.el.offsetWidth - at.x);
      maxY = Math.min(maxY, bounds.clientHeight - entry.el.offsetHeight - at.y);
    }
    gesture(
      event,
      (x, y) => {
        if (!moving && Math.hypot(x, y) < 4) return;
        if (!moving) {
          moving = true;
          for (const key of group) {
            const el = entries.current.get(key)?.el;
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const copy = el.cloneNode(true) as HTMLElement;
            copy.removeAttribute("id");
            copy.setAttribute("aria-hidden", "true");
            copy.setAttribute("data-drag-preview", "");
            Object.assign(copy.style, {
              position: "fixed",
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              pointerEvents: "none",
              opacity: "0.75",
              zIndex: "2147483646",
              margin: "0",
            });
            document.body.append(copy);
            copies.push(copy);
            el.setAttribute("data-dragging", "");
          }
        }
        delta = { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
        copies.forEach((copy) => {
          copy.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
        });
      },
      (cancelled) => {
        copies.forEach((copy) => {
          copy.remove();
        });
        group.forEach((key) => {
          entries.current.get(key)?.el.removeAttribute("data-dragging");
        });
        if (!moving) return;
        suppressClick.current = true;
        if (cancelled) return;
        setPositions((current) => {
          const next = { ...current };
          group.forEach((key) => {
            if (current[key])
              next[key] = {
                x: current[key].x + delta.x,
                y: current[key].y + delta.y,
              };
          });
          return next;
        });
      },
    );
  }

  function backgroundDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    suppressClick.current = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const original = selectedRef.current;
    const start = {
      x: event.clientX - bounds.left + event.currentTarget.scrollLeft,
      y: event.clientY - bounds.top + event.currentTarget.scrollTop,
    };
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    let touched = original;
    let moving = false;
    gesture(
      event,
      (dx, dy) => {
        if (!moving && Math.hypot(dx, dy) < 4) return;
        moving = true;
        const rect = {
          x: Math.min(start.x, start.x + dx),
          y: Math.min(start.y, start.y + dy),
          width: Math.abs(dx),
          height: Math.abs(dy),
        };

        const hits = [...entries.current]
          .filter(([, { el }]) => {
            const box = el.getBoundingClientRect();
            return (
              box.right > bounds.left + rect.x &&
              box.left < bounds.left + rect.x + rect.width &&
              box.bottom > bounds.top + rect.y &&
              box.top < bounds.top + rect.y + rect.height
            );
          })
          .map(([id]) => id);
        touched = [...new Set([...(additive ? original : []), ...hits])];
        setLasso({ ...rect, touched });
      },
      (cancelled) => {
        setLasso(null);
        if (!moving) return;
        suppressClick.current = true;
        select(cancelled ? original : touched);
      },
    );
  }

  function handleAll(event: KeyboardEvent | React.KeyboardEvent) {
    if (
      !active ||
      event.defaultPrevented ||
      ("nativeEvent" in event
        ? event.nativeEvent.isComposing
        : event.isComposing)
    )
      return false;
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.key.toLowerCase() !== "a"
    )
      return false;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input,textarea,select,[contenteditable="true"]')
    )
      return false;
    event.preventDefault();
    document.getSelection()?.removeAllRanges();
    select(keys());
    focus();
    return true;
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      handleAll(event);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });
  useLayoutEffect(() => {
    const target = focusRef.current ?? keys()[0];
    for (const [id, entry] of entries.current)
      entry.el.tabIndex = id === target ? 0 : -1;
    if (controller)
      Object.assign(controller, {
        focusItem: focus,
        getSelectedIds: () => [...selectedRef.current],
        editSelected,
        selectIfUnselected,
      });
  });
  useAgent(root, {
    component: "list",
    label: props["aria-label"] ?? "",
    actions: {
      focusItem: focus,
      selectIfUnselected,
      activate: (id: string) => onActivate?.(id, { reason: "item-press" }),
      editSelected,
    },
    items: [...entries.current].map(([value, entry]) => ({
      value,
      label: entry.label,
    })),
  });

  function key(id: string, event: React.KeyboardEvent) {
    if (
      event.target !== event.currentTarget ||
      event.nativeEvent.isComposing ||
      event.defaultPrevented
    )
      return;
    if (handleAll(event)) return;
    const toggleSpace =
      event.key === " " &&
      (!search.current.text || performance.now() - search.current.at > 500);
    if (["Enter", "F2", "Escape"].includes(event.key) || toggleSpace) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === "Enter" || event.key === "F2") editSelected();
      else if (event.key === "Escape") {
        search.current.text = "";
        select([]);
      } else if (
        !search.current.text ||
        performance.now() - search.current.at > 500
      )
        select(
          selectedRef.current.includes(id)
            ? selectedRef.current.filter((key) => key !== id)
            : [...selectedRef.current, id],
        );
      return;
    }
    const ordered = keys();
    let next: string | undefined;
    if (event.key === "Home") next = ordered[0];
    if (event.key === "End") next = ordered.at(-1);
    if (
      event.key.startsWith("Arrow") &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const current = entries.current.get(id)?.el.getBoundingClientRect();
      if (!current) return;
      const horizontal =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (layout === "vertical" && horizontal) return;
      const sign =
        event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const cx = current.left + current.width / 2,
        cy = current.top + current.height / 2;
      let best = Infinity;
      for (const [key, { el }] of entries.current) {
        if (key === id) continue;
        const box = el.getBoundingClientRect();
        const dx = box.left + box.width / 2 - cx,
          dy = box.top + box.height / 2 - cy;
        const primary = horizontal ? dx : dy;
        const secondary = horizontal ? dy : dx;
        if (primary * sign <= 1) continue;
        const score = Math.abs(primary) + Math.abs(secondary) * 4;
        if (score < best) {
          best = score;
          next = key;
        }
      }
    }
    if (next) {
      event.preventDefault();
      const from = focusRef.current ?? id;
      focus(next);
      search.current.text = "";
      if (event.shiftKey) {
        anchor.current ??= from;
        range(next, anchor.current);
      } else if (selectOnNavigation) {
        anchor.current = next;
        select([next]);
      }
      return;
    }
    if (
      event.key.length !== 1 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    const now = performance.now();
    const text =
      (now - search.current.at < 500 ? search.current.text : "") +
      event.key.toLocaleLowerCase();
    search.current = { text, at: now };
    const index = ordered.indexOf(id);
    const matches = [
      ...ordered.slice(index + 1),
      ...ordered.slice(0, index + 1),
    ];
    const match = findTypeaheadMatch(
      matches,
      text,
      (key) => entries.current.get(key)?.label ?? "",
    );
    if (match) focus(match, selectOnNavigation);
  }

  const api: ListAPI = {
    selected,
    focused,
    positions,
    layout,
    press,
    down,
    key,
    lasso,
    remember: (id) => {
      focusRef.current = id;
      setFocused(id);
    },
    register: (id, entry) => {
      if (entry) entries.current.set(id, entry);
      else entries.current.delete(id);
    },
  };
  return (
    <ListContext value={api}>
      <div
        {...props}
        ref={root}
        role="listbox"
        aria-multiselectable="true"
        tabIndex={-1}
        data-slot="list"
        data-layout={layout}
        data-lasso-active={lasso ? "" : undefined}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget) handleAll(event);
        }}
        onPointerDown={backgroundDown}
        onClick={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          search.current.text = "";
          select([]);
        }}
      >
        {children}
      </div>
    </ListContext>
  );
}

export function FileListItem({
  value,
  label,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value: string; label: string }) {
  const list = useList();
  const editor = useRef<(() => void) | null>(null);
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (element.current)
      list.register(value, { el: element.current, label, edit: editor });
    return () => list.register(value, null);
  }, [value, label, list.register]);
  const point = list.layout === "spatial" ? list.positions[value] : undefined;
  return (
    <ItemEditContext value={editor}>
      <div
        {...props}
        ref={element}
        role="option"
        aria-selected={list.selected.includes(value)}
        tabIndex={list.focused === value ? 0 : -1}
        data-slot="list-item"
        data-lassoed={list.lasso?.touched.includes(value) ? "" : undefined}
        data-value={value}
        style={{
          ...props.style,
          ...(point
            ? { position: "absolute", left: point.x, top: point.y }
            : {}),
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget) list.remember(value);
          props.onFocus?.(event);
        }}
        onPointerDown={(event) => {
          list.down(value, event);
          props.onPointerDown?.(event);
        }}
        onClick={(event) => {
          list.press(value, event);
          props.onClick?.(event);
        }}
        onDoubleClick={props.onDoubleClick}
        onKeyDown={(event) => list.key(value, event)}
      >
        {children}
      </div>
    </ItemEditContext>
  );
}

export function FileListLasso() {
  const { lasso } = useList();
  if (!lasso) return null;
  return (
    <div
      aria-hidden="true"
      className="lasso"
      style={{
        position: "absolute",
        left: lasso.x,
        top: lasso.y,
        width: lasso.width,
        height: lasso.height,
      }}
    />
  );
}
