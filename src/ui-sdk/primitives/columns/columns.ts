import {
  createChange,
  createRovingFocus,
  definePrimitive,
  dispatch,
} from "@ui-sdk/core";
import type { FileEntry } from "../../models/file-entry";
import { createListController } from "../list/list";

type ColumnProps = {
  value: string;
};

type ColumnRenderState = {
  active: boolean;
  controller: ReturnType<typeof createListController>;
  choose: (column: string, id: string | null) => void;
  open: (column: string, id: string) => void;
};

type ColumnsOptions = {
  root: FileEntry;
  items: FileEntry[];
  active: boolean;
  onOpen: (id: string) => void;
};

type ColumnsState = {
  path: string[];
  activeColumn: string | null;
  active: boolean;
};

export const columns = definePrimitive({
  name: "columns",
  options: {
    root: "value",
    items: "value",
    active: "boolean",
    onOpen: "callback",
  },
  state: (options: ColumnsOptions): ColumnsState => ({
    path: [],
    activeColumn: options.root.id,
    active: options.active,
  }),
  sync: (options) => ({ active: options.active }),
  api: (context) => {
    const change = createChange(context);
    const controllers: Record<
      string,
      ReturnType<typeof createListController>
    > = Object.create(null);
    controllers[context.options().root.id] = createListController();
    const roving = createRovingFocus<ColumnsState, ColumnProps>(context, {
      slot: "column",
      key: "activeColumn",
      orientation: () => "horizontal",
    });

    function folders(state = context.store.get()) {
      const { root, items } = context.options();
      const result = [root];
      for (const id of state.path) {
        const folder = items.find(
          (entry) =>
            entry.id === id &&
            entry.kind === "directory" &&
            entry.parentId === result.at(-1)?.id,
        );
        if (!folder) break;
        result.push(folder);
      }
      return result;
    }

    function choose(column: string, id: string | null) {
      const index = folders().findIndex((folder) => folder.id === column);
      if (index === -1) return;
      const { path } = context.store.get();
      if (path[index] === id) return;

      const entry = context
        .options()
        .items.find((entry) => entry.id === id && entry.parentId === column);
      if (entry?.kind !== "directory" && index === path.length) return;

      const next = path.slice(0, index);
      if (entry?.kind === "directory") next.push(entry.id);

      if (entry?.kind === "directory" && !controllers[entry.id]) {
        controllers[entry.id] = createListController();
      }
      for (const id of Object.keys(controllers)) {
        if (id !== context.options().root.id && !next.includes(id))
          delete controllers[id];
      }
      change("path", next, { reason: "selection" });
    }

    function open(column: string, id: string) {
      if (!folders().some((folder) => folder.id === column)) return;

      const entry = context
        .options()
        .items.find((entry) => entry.id === id && entry.parentId === column);
      if (!entry) return;

      if (entry?.kind === "directory") choose(column, id);
      else dispatch(context, "onOpen", id, { reason: "item-activate" });
    }

    function navigate(event: KeyboardEvent, el: HTMLElement) {
      const origin = event.composedPath()[0];
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        !(origin instanceof HTMLElement) ||
        !origin.matches('[role="option"], [role="listbox"]')
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const moved = roving.keydown(event, el);
      if (!moved) return;
      controllers[moved.key].focusItem(undefined, true);
      context
        .element("column", moved.key)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    return {
      roving,
      folders,
      choose,
      open,
      navigate,
      controllerFor: (id: string) => controllers[id],
    };
  },
  slots: (slot) => ({
    root: slot<object, { folders: FileEntry[] }>({
      role: "group",
      state: (state, { api }) => ({ folders: api.folders(state) }),
    }),
    column: slot<ColumnProps, ColumnRenderState>({
      role: "group",
      props: { value: "string" },
      state: (state, { key, api }) => ({
        active: state.active && state.activeColumn === key,
        controller: api.controllerFor(key),
        choose: api.choose,
        open: api.open,
      }),
      attrs: () => ({ tabindex: "-1" }),
      on: {
        focusin: (_, { key, api }) => api.roving.remember(key),
        pointerdown: (_, { key, api }) => api.roving.remember(key),
        keydown: (event, { el, api }) => {
          if (el) api.navigate(event, el);
        },
      },
      bind: (el, part) => {
        const unbind = part.api.roving.bind(el, part);
        if (part.store.get().path.at(-1) === part.key)
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
        return unbind;
      },
    }),
  }),
  agent: { actions: ["choose", "open"] },
});
