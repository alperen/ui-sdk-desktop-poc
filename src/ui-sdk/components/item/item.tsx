import { useContext, useEffect, useState } from "react";
import { useFileList } from "../../contexts/file-list-context";
import { ItemEditContext } from "../../contexts/item-edit-context";
import type { FileEntry } from "../../models/file-entry";
import { FileIcon } from "../file-icon/file-icon";
import { createItemController } from "../../primitives/item/item";
import {
  ItemIcon,
  ItemInput,
  ItemLabel,
  ItemRoot,
  ItemStatus,
} from "../../primitives/item/item-parts";

interface ItemProps {
  entry: FileEntry;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function Item({ entry, compact = false, disabled, loading }: ItemProps) {
  const { rename } = useFileList();
  const [controller] = useState(() => createItemController());
  const editor = useContext(ItemEditContext);

  useEffect(() => {
    if (!editor) return;

    editor.current = () => controller.startEditing();

    return () => {
      editor.current = null;
    };
  }, [editor, controller]);

  return (
    <ItemRoot
      value={entry.id}
      label={entry.name}
      controller={controller}
      onRename={rename}
      disabled={disabled}
      loading={loading}
    >
      <ItemIcon
        className={`pointer-events-none ${compact ? "size-5" : "size-12"} shrink-0 text-primary data-[loading-status=loading]:opacity-50`}
      >
        <FileIcon kind={entry.kind} />
      </ItemIcon>
      <ItemLabel className="max-w-full truncate text-xs font-medium">
        {entry.name}
        <span className="sr-only">
          {entry.kind === "directory" ? ", folder" : ", file"}
        </span>
      </ItemLabel>
      <ItemInput
        aria-label={`Rename ${entry.name}`}
        className={`w-full min-w-0 rounded-sm border border-primary bg-surface px-1 ${compact ? "text-left" : "text-center"} text-xs text-foreground outline-2 outline-offset-2 outline-primary select-text`}
      />
      <ItemStatus className="absolute -bottom-5 text-xs text-muted-foreground">
        Saving…
      </ItemStatus>
    </ItemRoot>
  );
}
