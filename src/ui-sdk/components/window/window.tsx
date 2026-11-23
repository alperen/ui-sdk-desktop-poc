import type { MovePoint } from "@ui-sdk/core";
import { useState } from "react";
import { ColumnView } from "../column-view/column-view";
import {
  FileListView,
  type MenuAction,
} from "../file-list-view/file-list-view";
import { Item } from "../item/item";
import type { FolderView } from "./view-layout-control";
import { FileWindow } from "./file-window";
import { useFileList } from "../../contexts/file-list-context";
import { useWindowManager } from "../../contexts/window-manager-context";
import type { FileEntry } from "../../models/file-entry";

interface WindowProps {
  item: FileEntry;
  attention: number;
  zIndex: number;
  defaultPosition: MovePoint;
}

export function Window({
  item,
  attention,
  zIndex,
  defaultPosition,
}: WindowProps) {
  const [view, setView] = useState<FolderView>("list");
  const { items } = useFileList();
  const { activeWindowId, openWindow, openWindows, closeWindow, focusWindow } =
    useWindowManager();

  function handleMenuAction(action: MenuAction) {
    if (action.type === "open") openWindow(action.id);
    else openWindows(action.ids);
  }

  return (
    <FileWindow
      entry={item}
      view={view}
      onViewChange={setView}
      attention={attention}
      active={item.id === activeWindowId}
      zIndex={zIndex}
      onActivate={focusWindow}
      defaultPosition={defaultPosition}
      onClose={closeWindow}
    >
      {item.kind === "directory" && view === "columns" ? (
        <ColumnView
          root={item}
          items={items}
          active={item.id === activeWindowId}
          onOpen={openWindow}
          onMenuAction={handleMenuAction}
        />
      ) : item.kind === "directory" ? (
        <FileListView
          items={items.filter((entry) => entry.parentId === item.id)}
          layout={view === "grid" ? "grid" : "vertical"}
          label={`${item.name} contents`}
          active={item.id === activeWindowId}
          onOpen={openWindow}
          onMenuAction={handleMenuAction}
          renderItem={(entry) => (
            <Item entry={entry} compact={view !== "grid"} />
          )}
        />
      ) : undefined}
    </FileWindow>
  );
}
