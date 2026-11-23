import {
  createController,
  createInlineEdit,
  definePrimitive,
} from "@ui-sdk/core";

type ItemOptions = {
  value: string;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  controller?: ReturnType<typeof createItemController>;
  onRename?: (id: string, name: string) => void;
};

type ItemState = {
  editingId: string | null;
  loadingStatus: "idle" | "loading";
};

type LoadingState = Pick<ItemState, "loadingStatus">;

function createItemController() {
  return createController<{ startEditing: () => void }>();
}

const item = definePrimitive({
  name: "item",
  options: {
    value: "string",
    label: "string",
    disabled: "boolean",
    loading: "boolean",
    controller: "value",
    onRename: "callback",
  },
  state: (options: ItemOptions): ItemState => ({
    editingId: null,
    loadingStatus: options.loading ? "loading" : "idle",
  }),
  sync: (options): Partial<ItemState> => ({
    loadingStatus: options.loading ? "loading" : "idle",
  }),
  api: (context) => {
    const edit = createInlineEdit(context, {
      key: "editingId",
      value: () => context.options().label,
      disabled: () =>
        !!context.options().disabled || !context.options().onRename,
      commit: (id, text) => {
        const name = text.trim();
        if (!name) return false;

        context.options().onRename?.(id, name);
        return true;
      },
    });

    function startEditing() {
      edit.start(context.options().value, { reason: "edit-key" });
    }

    function handleInputKeydown(event: KeyboardEvent) {
      event.stopPropagation();
      if (event.isComposing || (event.key === "Enter" && event.keyCode === 229))
        return;

      if (event.key === "Tab") {
        edit.cancel();
        return;
      }

      edit.inputKeydown(event);
    }

    return { edit, startEditing, handleInputKeydown };
  },
  slots: (slot) => ({
    root: slot({}),
    icon: slot<object, LoadingState>({
      state: (state) => ({ loadingStatus: state.loadingStatus }),
      attrs: (state) => ({
        "aria-hidden": "true",
        "data-loading-status": state.loadingStatus,
      }),
    }),
    label: slot<object, LoadingState>({
      state: (state) => ({ loadingStatus: state.loadingStatus }),
      present: (state) => state.editingId === null,
      attrs: (state) => ({ "data-loading-status": state.loadingStatus }),
    }),
    input: slot({
      present: (state) => state.editingId !== null,
      attrs: () => ({ type: "text", required: "", autocomplete: "off" }),
      on: {
        pointerdown: (event) => event.stopPropagation(),
        click: (event) => event.stopPropagation(),
        dblclick: (event) => event.stopPropagation(),
        focusout: (event, { api }) => {
          api.edit.cancel();

          const next = event.relatedTarget;
          if (next instanceof HTMLElement) next.focus();
        },
      },
      bind: (el, { api }) => {
        const unbindInput = api.edit.bindInput(el as HTMLInputElement);

        function stopKeyup(event: KeyboardEvent) {
          event.stopPropagation();
        }

        // Stop keys at the input before delegated parent handlers receive them.
        el.addEventListener("keydown", api.handleInputKeydown);
        el.addEventListener("keyup", stopKeyup);

        return () => {
          el.removeEventListener("keydown", api.handleInputKeydown);
          el.removeEventListener("keyup", stopKeyup);
          unbindInput();
        };
      },
    }),
    status: slot<object, LoadingState>({
      state: (state) => ({ loadingStatus: state.loadingStatus }),
      role: "status",
      present: (state) => state.loadingStatus === "loading",
      attrs: (state) => ({ "data-loading-status": state.loadingStatus }),
    }),
  }),
  agent: { actions: ["startEditing"] },
});

export { createItemController, item };
