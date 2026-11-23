import { useLayoutEffect, useRef, useState } from "react";
import { FileListView, type MenuAction } from "../file-list-view/file-list-view";
import { ControlIcon } from "../control-icon/control-icon";
import { Item } from "../item/item";
import { createListController } from "../../primitives/list/list";
import type { FileEntry } from "../../models/file-entry";

type Props = {
  root: FileEntry;
  items: FileEntry[];
  active: boolean;
  onOpen: (id: string) => void;
  onMenuAction: (action: MenuAction) => void;
};
export function ColumnView(props: Props) {
  return <Columns key={props.root.id} {...props} />;
}
function Columns({ root, items, active, onOpen, onMenuAction }: Props) {
  const [path, setPath] = useState<string[]>([]);
  const [current, setCurrent] = useState(root.id);
  const controllers = useRef(
    new Map<string, ReturnType<typeof createListController>>(),
  );
  const container = useRef<HTMLFieldSetElement>(null);
  const folders = [root];
  for (const id of path) {
    const folder = items.find(
      (entry) =>
        entry.id === id &&
        entry.parentId === folders.at(-1)?.id &&
        entry.kind === "directory",
    );
    if (!folder) break;
    folders.push(folder);
  }

  function controller(id: string) {
    let value = controllers.current.get(id);
    if (!value) {
      value = createListController();
      controllers.current.set(id, value);
    }
    return value;
  }
  const ids = folders.map((folder) => folder.id);
  const last = ids.at(-1);
  useLayoutEffect(() => {
    if (ids.includes(current)) return;
    const id = ids.at(-1) ?? root.id;
    setCurrent(id);
    controller(id).focusItem();
  });
  useLayoutEffect(() => {
    const columns = container.current?.children;
    const el =
      columns &&
      [...columns].find(
        (column) => column.getAttribute("data-column") === last,
      );
    if (el instanceof HTMLElement)
      el.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [last]);

  function choose(column: string, id: string | null) {
    const index = ids.indexOf(column);
    if (index < 0 || path[index] === id) return;
    const folder = items.find(
      (entry) =>
        entry.id === id &&
        entry.parentId === column &&
        entry.kind === "directory",
    );
    if (!folder && index === path.length) return;
    const next = path.slice(0, index);
    if (folder) next.push(folder.id);
    for (const key of controllers.current.keys()) {
      if (key !== root.id && !next.includes(key))
        controllers.current.delete(key);
    }
    setPath(next);
  }
  return (
    <fieldset
      ref={container}
      aria-label={`${root.name} columns`}
      className="columns"
    >
      {folders.map((folder) => (
        <fieldset
          key={folder.id}
          data-column={folder.id}
          aria-label={`${folder.name} column`}
          tabIndex={-1}
          className="column"
          onPointerDownCapture={() => setCurrent(folder.id)}
          onFocusCapture={() => setCurrent(folder.id)}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey
            )
              return;
            if (
              !(event.target instanceof HTMLElement) ||
              !event.target.matches('[role="option"],[role="listbox"]')
            )
              return;
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const rtl =
              getComputedStyle(event.currentTarget).direction === "rtl";
            const delta =
              event.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : -1;
            const index = ids.indexOf(folder.id) + delta;
            if (index < 0 || index >= ids.length) return;
            event.preventDefault();
            setCurrent(ids[index]);
            controller(ids[index]).focusItem(undefined, true);
          }}
        >
          <FileListView
            items={items.filter((entry) => entry.parentId === folder.id)}
            layout="vertical"
            label={`${folder.name} contents`}
            active={active && current === folder.id}
            controller={controller(folder.id)}
            selectOnNavigation
            onCurrentItemChange={(id) => choose(folder.id, id)}
            onOpen={(id) => {
              const entry = items.find(
                (entry) => entry.id === id && entry.parentId === folder.id,
              );
              if (entry?.kind === "directory") choose(folder.id, id);
              else if (entry) onOpen(id);
            }}
            onMenuAction={onMenuAction}
            renderItem={(entry) => (
              <>
                <Item entry={entry} compact />
                {entry.kind === "directory" && (
                  <ControlIcon name="chevron" className="folder-chevron" />
                )}
              </>
            )}
          />
        </fieldset>
      ))}
    </fieldset>
  );
}
