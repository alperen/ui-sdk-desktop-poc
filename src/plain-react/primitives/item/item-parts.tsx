import {
  createContext,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ItemEditContext } from "../../contexts/item-edit-context";
import type { createItemController } from "./item";

type EditState = {
  editing: boolean;
  loadingStatus: "loading" | "idle";
  label: string;
  finish: (save?: string, restore?: boolean) => void;
};
const EditContext = createContext<EditState | null>(null);

export function ItemRoot({
  value,
  label,
  controller,
  onRename,
  disabled,
  loading,
  children,
}: {
  value: string;
  label: string;
  controller?: ReturnType<typeof createItemController>;
  onRename?: (id: string, name: string) => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const editor = useContext(ItemEditContext);

  function start() {
    if (disabled || !onRename) return;
    returnTo.current = document.activeElement as HTMLElement;
    setEditing(true);
  }
  useLayoutEffect(() => {
    if (controller) controller.startEditing = start;
    if (editor) editor.current = start;
    return () => {
      if (controller) controller.startEditing = () => {};
      if (editor) editor.current = null;
    };
  });

  function finish(save?: string, restore = true) {
    if (save !== undefined) {
      const trimmed = save.trim();
      if (!trimmed) return;
      onRename?.(value, trimmed);
    }
    setEditing(false);
    if (restore) returnTo.current?.focus();
  }
  return (
    <EditContext
      value={{
        editing,
        loadingStatus: loading ? "loading" : "idle",
        label,
        finish,
      }}
    >
      {children}
    </EditContext>
  );
}

function useEdit() {
  const edit = useContext(EditContext);
  if (!edit) throw new Error("Missing ItemRoot");
  return edit;
}

export function ItemIcon(props: HTMLAttributes<HTMLSpanElement>) {
  const { loadingStatus } = useEdit();
  return (
    <span {...props} aria-hidden="true" data-loading-status={loadingStatus} />
  );
}

export function ItemLabel(props: HTMLAttributes<HTMLSpanElement>) {
  const edit = useEdit();
  if (edit.editing) return null;
  return <span {...props} data-loading-status={edit.loadingStatus} />;
}

export function ItemStatus({
  children,
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  children?:
    | ReactNode
    | ((state: { loadingStatus: "idle" | "loading" }) => ReactNode);
}) {
  const edit = useEdit();
  if (edit.loadingStatus !== "loading") return null;
  return (
    <span {...props} role="status" data-loading-status={edit.loadingStatus}>
      {typeof children === "function" ? children(edit) : children}
    </span>
  );
}

export function ItemInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const edit = useEdit();
  if (!edit.editing) return null;
  return <Editor {...props} edit={edit} />;
}
function Editor({
  edit,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { edit: EditState }) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <input
      {...props}
      ref={input}
      type="text"
      required
      autoComplete="off"
      defaultValue={edit.label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={() => edit.finish(undefined, false)}
      onKeyUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          edit.finish(event.currentTarget.value);
        }
        if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") event.preventDefault();
          edit.finish(undefined, event.key !== "Tab");
        }
      }}
    />
  );
}
