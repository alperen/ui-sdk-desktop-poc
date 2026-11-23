import {
  createMenuController,
  Menu,
  MenuContent,
  MenuContextTrigger,
  MenuItem,
} from "@ui-sdk/react/menu";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { FileEntry } from "../../models/file-entry";
import { createListController, type ListLayout } from "../../primitives/list/list";
import {
  FileList,
  FileListItem,
  FileListLasso,
} from "../../primitives/list/file-list-parts";

export type MenuAction =
  | { type: "open"; id: string }
  | { type: "open-all"; ids: string[] };

type FileListViewProps = {
  label?: string;
  items: FileEntry[];
  active: boolean;
  onActivate?: () => void;
  controller?: ReturnType<typeof createListController>;
  selectOnNavigation?: boolean;
  onOpen: (id: string) => void;
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
  layout,
  active,
  onActivate,
  items,
  defaultPositions,
  controller: providedController,
  selectOnNavigation,
  onOpen,
  onMenuAction,
  onCurrentItemChange,
  renderItem,
}: FileListViewProps) {
  const emptyMessageId = useId();
  const [selectionCount, setSelectionCount] = useState(0);
  const [controller] = useState(
    () => providedController ?? createListController(),
  );
  const [menu] = useState(() => createMenuController<string>());

  useEffect(() => {
    if (active && document.activeElement === document.body)
      controller.focusItem();
  }, [controller, active]);

  function handleMenuOpenChange(open: boolean) {
    const payload = menu.getPayload();
    if (!open || !payload) return;

    controller.selectIfUnselected(payload);
  }

  function handleMenuPayloadChange(payload: unknown) {
    if (typeof payload !== "string") return;

    controller.selectIfUnselected(payload);
  }

  function handleMenuAction(action: string) {
    const selectedIds = controller.getSelectedIds();
    const targets = items.filter((item) => selectedIds.includes(item.id));

    if (action === "open") {
      if (targets.length === 1)
        onMenuAction({ type: "open", id: targets[0].id });
      else if (targets.length > 1)
        onMenuAction({ type: "open-all", ids: targets.map((item) => item.id) });
      return;
    }

    if (action === "rename") {
      controller.editSelected();
      return;
    }
  }

  return (
    <Menu
      controller={menu}
      onOpenChange={handleMenuOpenChange}
      onPayloadChange={handleMenuPayloadChange}
      onAction={handleMenuAction}
    >
      <FileList
        className={
          layout === "spatial"
            ? "relative isolate min-w-120 flex-1 touch-none select-none"
            : `relative isolate min-h-full w-full touch-none select-none p-2 ${layout === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] content-start gap-2" : ""}`
        }
        layout={layout}
        active={active}
        onPointerDownCapture={onActivate}
        selectOnNavigation={selectOnNavigation}
        onFocusCapture={onActivate}
        defaultPositions={layout === "spatial" ? defaultPositions : {}}
        controller={controller}
        aria-label={label}
        aria-describedby={items.length ? undefined : emptyMessageId}
        onActivate={onOpen}
        onSelectedIdsChange={(ids) => {
          setSelectionCount(ids.length);
          onCurrentItemChange?.(ids.length === 1 ? ids[0] : null);
        }}
      >
        {items.map((item) => (
          <MenuContextTrigger
            key={item.id}
            payload={item.id}
            render={
              <FileListItem
                className={
                  layout === "vertical"
                    ? "desktop-item flex h-9 w-full cursor-default items-center gap-2 border border-transparent px-2 text-foreground"
                    : `desktop-item flex ${layout === "spatial" ? "w-32" : "min-w-0"} cursor-default flex-col items-center gap-2 border border-transparent px-2 py-3 text-center text-foreground`
                }
                value={item.id}
                label={item.name}
              />
            }
          >
            {renderItem(item)}
          </MenuContextTrigger>
        ))}

        {!items.length && (
          <p
            id={emptyMessageId}
            className="pointer-events-none absolute left-5 top-5 text-muted-foreground"
          >
            No files here.
          </p>
        )}

        <FileListLasso className="pointer-events-none z-3 border border-primary bg-primary/10" />
      </FileList>

      <MenuContent
        aria-label="File actions"
        className="file-actions m-0 min-w-48 overflow-y-auto overscroll-contain border border-transparent bg-surface p-1 text-sm text-foreground"
        container={typeof document === "undefined" ? undefined : document.body}
      >
        <MenuItem
          className="flex cursor-default items-center justify-between gap-6 px-3 py-2"
          value="open"
        >
          {selectionCount > 1 ? `Open (${selectionCount})` : "Open"}
        </MenuItem>
        <MenuItem
          className="cursor-default px-3 py-2 data-disabled:opacity-50"
          value="rename"
          disabled={selectionCount !== 1}
        >
          Rename
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
