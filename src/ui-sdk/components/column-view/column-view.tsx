import { ChevronRight } from "lucide-react";
import type { FileEntry } from "../../models/file-entry";
import { FileListView, type MenuAction } from "../file-list-view/file-list-view";
import {
  ColumnsColumn,
  ColumnsRoot,
} from "../../primitives/columns/columns-parts";
import { Item } from "../item/item";

interface ColumnViewProps {
  root: FileEntry;
  items: FileEntry[];
  active: boolean;
  onOpen: (id: string) => void;
  onMenuAction: (action: MenuAction) => void;
}

export function ColumnView({
  root,
  items,
  active,
  onOpen,
  onMenuAction,
}: ColumnViewProps) {
  return (
    <ColumnsRoot
      key={root.id}
      root={root}
      items={items}
      active={active}
      onOpen={onOpen}
      aria-label={`${root.name} columns`}
      className="flex h-full min-h-0 overflow-x-auto"
    >
      {({ folders }) =>
        folders.map((folder) => (
          <ColumnsColumn
            key={folder.id}
            value={folder.id}
            aria-label={`${folder.name} column`}
            className="h-full w-60 shrink-0 overflow-y-auto border-r border-border"
          >
            {(column) => (
              <FileListView
                controller={column.controller}
                selectOnNavigation
                items={items.filter((entry) => entry.parentId === folder.id)}
                layout="vertical"
                label={`${folder.name} contents`}
                active={column.active}
                onCurrentItemChange={(id) => column.choose(folder.id, id)}
                onOpen={(id) => column.open(folder.id, id)}
                onMenuAction={onMenuAction}
                renderItem={(entry) => (
                  <>
                    <Item entry={entry} compact />
                    {entry.kind === "directory" && (
                      <ChevronRight
                        aria-hidden="true"
                        size={14}
                        className="ml-auto shrink-0"
                      />
                    )}
                  </>
                )}
              />
            )}
          </ColumnsColumn>
        ))
      }
    </ColumnsRoot>
  );
}
