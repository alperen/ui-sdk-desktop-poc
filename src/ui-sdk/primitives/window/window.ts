import {
  createChange,
  createResize,
  css,
  definePrimitive,
  live,
  type MovePoint,
  type ResizeBox,
  type ResizeDraft,
  type ResizeHandle,
} from "@ui-sdk/core";

type WindowResizeDirection = Exclude<ResizeHandle, "move">;

type WindowOptions = {
  label: string;
  defaultPosition?: MovePoint;
  active?: boolean;
  zIndex?: number;
  onActivate?: () => void;
};

type WindowState = {
  box: ResizeBox;
  resizing: ResizeDraft | null;
  maximized: boolean;
  active: boolean;
  zIndex: number;
};

const windowPrimitive = definePrimitive({
  name: "window",
  options: {
    label: "string",
    defaultPosition: "value",
    active: "boolean",
    zIndex: "number",
    onActivate: "callback",
  },
  state: (options: WindowOptions): WindowState => ({
    box: {
      ...(options.defaultPosition ?? { x: 80, y: 160 }),
      width: 800,
      height: 360,
    },
    resizing: null,
    maximized: false,
    active: options.active ?? false,
    zIndex: options.zIndex ?? 1,
  }),
  sync: (options) => ({
    active: options.active ?? false,
    zIndex: options.zIndex ?? 1,
  }),
  live: ["resizing"],
  api: (context) => {
    const change = createChange(context);
    const resize = createResize(context, {
      boxes: (state) => ({ window: state.box }),
      draft: "resizing",
      set: (boxes, details) => change("box", boxes.window, details),
      min: () => ({ width: 240, height: 120 }),
      disabled: () => context.store.get().maximized,
      label: () => context.options().label,
      step: () => 4,
      bounds: () => {
        const workspace = context.element("root")?.parentElement;
        if (!workspace) return;

        return {
          left: 0,
          top: 0,
          right: Math.floor(workspace.clientWidth / 4) * 4,
          bottom: Math.floor(workspace.clientHeight / 4) * 4,
        };
      },
    });

    function moveTo(point: MovePoint) {
      const current = context.store.get().box;

      return resize.resizeBy(
        "window",
        "move",
        point.x - current.x,
        point.y - current.y,
      );
    }

    function moveWithKeyboard(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
        return;

      const directions: Record<string, MovePoint> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const direction = directions[event.key];
      if (!direction) return;

      event.preventDefault();

      const step = event.shiftKey ? 40 : 4;
      resize.resizeBy(
        "window",
        "move",
        direction.x * step,
        direction.y * step,
        { reason: "resize-key", event },
      );
    }

    function toggleMaximized() {
      activate();
      change("maximized", !context.store.get().maximized, {
        reason: "maximize-press",
      });
    }

    function activate() {
      context.options().onActivate?.();
    }

    return {
      resize,
      moveTo,
      moveWithKeyboard,
      activate,
      toggleMaximized,
      label: () => context.options().label,
    };
  },
  slots: (slot) => ({
    root: slot({
      bind: (_, { api }) => {
        api.resize.resizeBy("window", "move", 0, 0);
        api.resize.resizeBy("window", "se", 0, 0);
      },
      attrs: (state, { api }) => ({
        tabindex: "-1",
        "data-active": state.active ? "" : undefined,
        "data-maximized": state.maximized ? "" : undefined,
        style: [
          css({ position: "absolute", "z-index": String(state.zIndex) }),
          state.maximized
            ? css({ left: 0, top: 0, width: "100%", height: "100%" })
            : api.resize.boxStyle(state, "window"),
        ].join(";"),
      }),
      live: live((state, { api }) => ({
        "data-dragging":
          api.resize.dragging(state, "window") === "move" ? "" : undefined,
        "data-resizing":
          state.resizing && state.resizing.handle !== "move" ? "" : undefined,
        style: api.resize.style(state, "window"),
      })),
      on: {
        pointerdown: (event, { api }) => {
          if (event.button !== 0) return;

          api.activate();
        },
        focusin: (_, { api }) => api.activate(),
      },
    }),
    handle: slot({
      attrs: () => ({ type: "button" }),
      on: {
        pointerdown: (event, { api, el }) => {
          if (!el || event.target !== el || event.button !== 0) return;

          el.focus();
          api.resize.pointerdown(event, "window", "move", el);
        },
        keydown: (event, { api }) => api.moveWithKeyboard(event),
        dblclick: (_, { api }) => api.toggleMaximized(),
      },
    }),
    maximize: slot<object, { maximized: boolean }>({
      state: (state) => ({ maximized: state.maximized }),
      attrs: (state, { api }) => ({
        type: "button",
        "aria-label": `${state.maximized ? "Restore" : "Maximize"} ${api.label()}`,
      }),
      press: ({ api }) => api.toggleMaximized(),
    }),
    "resize-handle": slot<{ id: string; direction: WindowResizeDirection }>({
      present: (state) => !state.maximized,
      props: { id: "id", direction: "string" },
      attrs: (_, { api, props }) => ({
        type: "button",
        ...api.resize.handleAttrs(props.direction),
      }),
      on: {
        pointerdown: (event, { api, el, props }) => {
          if (!el || event.button !== 0) return;

          el.focus();
          api.resize.pointerdown(event, "window", props.direction, el);
        },
        keydown: (event, { api, props }) =>
          api.resize.keydown(event, "window", props.direction),
      },
    }),
    content: slot({}),
  }),
  agent: { actions: ["moveTo", "activate", "toggleMaximized"] },
});

export { type WindowResizeDirection, windowPrimitive };
