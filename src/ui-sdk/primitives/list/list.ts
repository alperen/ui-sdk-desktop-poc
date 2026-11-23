import {
  bindDragPreview,
  type ChangeDetails,
  createChange,
  createController,
  createLasso,
  createMove,
  createRovingFocus,
  createSelection,
  createTypeahead,
  css,
  type DragPreview,
  definePrimitive,
  dispatch,
  isTypeaheadKey,
  type LassoDraft,
  live,
  type MoveDraft,
  selects,
  spatialMove,
} from "@ui-sdk/core";

type SelectionReason =
  | "item-press"
  | "list-navigation"
  | "escape-key"
  | "lasso"
  | "context-menu"
  | "background-press";

type ListLayout = "spatial" | "vertical" | "grid";

type ListOptions = {
  layout: ListLayout;
  active: boolean;
  selectOnNavigation?: boolean;
  defaultPositions: Record<string, { x: number; y: number }>;
  controller?: ReturnType<typeof createListController>;
  onActivate?: (key: string, details: ChangeDetails<"item-press">) => void;
  onSelectedIdsChange?: (
    selectedIds: string[],
    details: ChangeDetails<SelectionReason>,
  ) => void;
};

type ListState = {
  layout: ListLayout;
  focusedId: string | null;
  selectedIds: string[];
  lasso: LassoDraft | null;
  moving: MoveDraft | null;
  positions: Record<string, { x: number; y: number }>;
};

type ItemProps = {
  value: string;
  label: string;
  onEdit?: () => void;
};

function createListController() {
  return createController<{
    focusItem: (key?: string, select?: boolean) => void;
    getSelectedIds: () => string[];
    editSelected: () => void;
    selectIfUnselected: (key: string) => string[];
  }>();
}

const list = definePrimitive({
  name: "list",
  options: {
    layout: "string",
    active: "boolean",
    selectOnNavigation: "boolean",
    defaultPositions: "value",
    controller: "value",
    onActivate: "callback",
    onSelectedIdsChange: "callback",
  },
  state: (options: ListOptions): ListState => ({
    layout: options.layout,
    focusedId: null,
    selectedIds: [],
    lasso: null,
    moving: null,
    positions: options.defaultPositions,
  }),
  sync: (options) => ({ layout: options.layout }),
  live: ["lasso", "moving"],
  api: (context) => {
    const change = createChange(context);

    const roving = createRovingFocus<ListState, ItemProps>(context, {
      slot: "item",
      key: "focusedId",
      move: spatialMove(),
    });

    const typeahead = createTypeahead();

    const selection = createSelection(context, {
      key: "selectedIds",
      multiple: () => true,
      set: (value, details) => change("selectedIds", value, details),
      order: () => roving.items().map((item) => item.key),
    });

    const lasso = createLasso(context, {
      slot: "item",
      draft: "lasso",
      selected: () => context.store.get().selectedIds,
      set: (keys, details) => change("selectedIds", keys, details),
    });

    const move = createMove(context, {
      key: "positions",
      draft: "moving",
      group: getMoveGroup,
      bounds: getMoveBounds,
      set: (positions, details) => change("positions", positions, details),
    });

    function getMoveGroup(key: string) {
      const { selectedIds } = context.store.get();

      return selectedIds.includes(key) ? selectedIds : [key];
    }

    function getMoveBounds(key: string) {
      const desktop = context.element("root");
      const { positions } = context.store.get();
      const position = positions[key];
      if (!desktop || !position) return;

      let minDx = -Infinity;
      let minDy = -Infinity;
      let maxDx = Infinity;
      let maxDy = Infinity;

      for (const id of getMoveGroup(key)) {
        const item = context.element("item", id);
        const at = positions[id];
        if (!item || !at) continue;

        minDx = Math.max(minDx, -at.x);
        minDy = Math.max(minDy, -at.y);
        maxDx = Math.min(maxDx, desktop.clientWidth - item.offsetWidth - at.x);
        maxDy = Math.min(
          maxDy,
          desktop.clientHeight - item.offsetHeight - at.y,
        );
      }

      return {
        minX: position.x + minDx,
        minY: position.y + minDy,
        maxX: position.x + Math.max(minDx, maxDx),
        maxY: position.y + Math.max(minDy, maxDy),
      };
    }

    function clearSelection(event: Event) {
      typeahead.reset();
      change("selectedIds", [], { reason: "background-press", event });
    }

    function activate(key: string, event?: Event) {
      if (!roving.items().some((item) => item.key === key)) return;

      dispatch(context, "onActivate", key, { reason: "item-press", event });
    }

    function focusItem(key?: string, select = false) {
      if (!roving.items().length) {
        context.element("root")?.focus();
        return;
      }

      roving.focus(key);
      const focused = context.store.get().focusedId;
      if (select && focused)
        selection.choose(focused, { reason: "list-navigation" });
    }

    function editSelected() {
      const { selectedIds } = context.store.get();
      if (selectedIds.length !== 1) return;

      typeahead.reset();
      context.props<ItemProps>("item", selectedIds[0])?.onEdit?.();
    }

    function getSelectedIds() {
      return [...context.store.get().selectedIds];
    }

    function selectIfUnselected(
      key: string,
      reason: SelectionReason = "context-menu",
      event?: Event,
    ) {
      const selected = context.store.get().selectedIds.includes(key);
      if (!selected) {
        selection.choose(key, { reason, event });
      }

      return context.store.get().selectedIds;
    }

    function search(event: KeyboardEvent, el: HTMLElement) {
      if (event.defaultPrevented || !isTypeaheadKey(event)) return;

      event.preventDefault();

      const items = roving.items();
      const labels = items.map((item) => item.props.label);
      const currentIndex = items.findIndex((item) => item.el === el);

      const matchIndex = typeahead(event.key, labels, currentIndex);
      if (matchIndex === -1) return;

      focusItem(items[matchIndex].key, context.options().selectOnNavigation);
    }

    function pressItem(key: string, event?: Event) {
      const details = { reason: "item-press" as const, event };
      if (!(event instanceof MouseEvent)) {
        selection.choose(key, details);
        return;
      }

      if (event.shiftKey) {
        selection.extend(key, {
          ...details,
          from: context.store.get().focusedId,
          additive: false,
        });
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        selection.toggle(key, details);
        return;
      }

      selection.choose(key, details);
    }

    function handleSelectAll(event: KeyboardEvent) {
      if (event.isComposing || event.defaultPrevented) return false;

      const selectAll =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "a";
      if (!selectAll) return false;

      event.preventDefault();
      context.element("root")?.ownerDocument.getSelection()?.removeAllRanges();

      const keys = roving.items().map((item) => item.key);
      change("selectedIds", keys, { reason: "list-navigation", event });

      return true;
    }

    function handleKeydown(
      event: KeyboardEvent,
      key: string,
      el: HTMLElement | undefined,
    ) {
      if (event.target !== el) return;

      const lassoActive = !!context.store.get().lasso;
      if (lassoActive || event.isComposing || event.defaultPrevented) return;

      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        if (event.repeat) return;

        editSelected();
        return;
      }

      if (event.key === " " && !typeahead.active()) {
        event.preventDefault();
        if (event.repeat) return;

        selection.toggle(key, { reason: "item-press", event });
        return;
      }

      if (handleSelectAll(event)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        typeahead.reset();
        change("selectedIds", [], { reason: "escape-key", event });
        return;
      }

      if (!el || event.isComposing || event.defaultPrevented) return;

      const moved = roving.keydown(event, el);
      if (!moved) {
        search(event, el);
        return;
      }

      typeahead.reset();
      if (!moved.shift) {
        if (context.options().selectOnNavigation)
          selection.choose(moved.key, { reason: "list-navigation", event });
        return;
      }

      selection.extend(moved.key, {
        from: moved.from,
        additive: false,
        reason: "list-navigation",
        event,
      });
    }

    return {
      roving,
      getLayout: () => context.store.get().layout,
      isActive: () => context.options().active,
      clearSelection,
      lasso,
      move,
      activate,
      focusItem,
      selectIfUnselected,
      getSelectedIds,
      editSelected,
      pressItem,
      handleKeydown,
      handleSelectAll,
    };
  },
  slots: (slot) => ({
    root: slot({
      role: "listbox",
      attrs: (_, { api }) => ({
        "aria-multiselectable": "true",
        tabindex: "-1",
        "data-layout": api.getLayout(),
      }),
      live: live((state) => ({
        "data-lasso-active": state.lasso ? "" : undefined,
      })),
      keys: { none: "Each option handles navigation with roving focus." },
      bind: (el, { api }) => {
        const document = el.ownerDocument;

        function handlePageKeydown(event: KeyboardEvent) {
          const target = event.target;
          if (!api.isActive() || !(target instanceof HTMLElement)) return;
          if (
            target.closest(
              'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
            )
          )
            return;

          if (api.handleSelectAll(event)) api.focusItem();
        }

        document.addEventListener("keydown", handlePageKeydown);

        return () => document.removeEventListener("keydown", handlePageKeydown);
      },
      on: {
        keydown: (event, { el, api }) => {
          if (event.target !== el) return;

          api.handleSelectAll(event);
        },
        click: (event, { el, api }) => {
          if (event.target !== el || event.button !== 0) return;
          if (event.shiftKey || event.ctrlKey || event.metaKey) return;

          api.clearSelection(event);
        },
        pointerdown: (event, { el, api }) => {
          if (!el || event.target !== el) return;

          api.lasso.pointerdown(event, el);
        },
      },
    }),
    item: slot<ItemProps>({
      role: "option",
      focus: "roving",
      props: {
        value: "string",
        label: "string",
        onEdit: "callback",
      },
      selects: selects({
        focusedId: ({ key }) => [key, null],
        selectedIds: ({ key }) => [key],
      }),
      attrs: (state, part) => {
        const position =
          part.api.getLayout() === "spatial"
            ? state.positions[part.key]
            : undefined;

        return {
          "aria-selected": String(state.selectedIds.includes(part.key)),
          tabindex: part.api.roving.tabIndex(state, part),
          style: position
            ? css({
                position: "absolute",
                left: `${position.x}px`,
                top: `${position.y}px`,
              })
            : undefined,
        };
      },
      live: live((state, { key, api }) => ({
        "data-lassoed": api.lasso.touches(state, key) ? "" : undefined,
        "data-dragging": api.move.dragging(state, key) ? "" : undefined,
      })),
      press: ({ key, api }, event) => api.pressItem(key, event),
      on: {
        pointerdown: (event, { key, el, api }) => {
          if (!el || event.button !== 0) return;

          const modified = event.shiftKey || event.ctrlKey || event.metaKey;
          if (!modified) api.selectIfUnselected(key, "item-press", event);

          if (api.getLayout() === "spatial")
            api.move.pointerdown(event, key, el);
        },
        dblclick: (event, { key, api }) => api.activate(key, event),
        keydown: (event, { key, el, api }) => api.handleKeydown(event, key, el),
      },
      bind: (el, part) => {
        const unbindFocus = part.api.roving.bind(el, part);
        let preview: DragPreview | undefined;

        const unsubscribe = part.store.subscribe(() => {
          const state = part.store.get();
          const dragging = part.api.move.dragging(state, part.key);

          if (!dragging || !state.moving) {
            preview?.remove();
            preview = undefined;
            return;
          }

          if (!preview) {
            preview = bindDragPreview(el, { x: 0, y: 0 });
          }

          preview.move(state.moving.dx, state.moving.dy);
        });

        return () => {
          unsubscribe();
          preview?.remove();
          unbindFocus?.();
        };
      },
    }),
    lasso: slot({
      attrs: () => ({ "aria-hidden": "true" }),
      live: live((state, { api }) => ({ style: api.lasso.style(state) })),
    }),
  }),
  agent: {
    actions: ["focusItem", "selectIfUnselected", "activate", "editSelected"],
    items: (api) =>
      api.roving
        .items()
        .map(({ key, props }) => ({ value: key, label: props.label })),
  },
});

export { createListController, type ListLayout, list };
