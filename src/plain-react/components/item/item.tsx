import { FileIcon } from "../file-icon/file-icon";
import type { FileEntry } from "../../models/file-entry";
import { useFileList } from "../../contexts/file-list-context";
import {
  ItemIcon,
  ItemInput,
  ItemLabel,
  ItemRoot,
  ItemStatus,
} from "../../primitives/item/item-parts";

export function Item({
  entry,
  compact = false,
  disabled,
  loading,
}: {
  entry: FileEntry;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { rename } = useFileList();
  return (
    <ItemRoot
      value={entry.id}
      label={entry.name}
      onRename={rename}
      disabled={disabled}
      loading={loading}
    >
      <ItemIcon className={`file-icon ${compact ? "compact" : ""}`}>
        <FileIcon kind={entry.kind} />
      </ItemIcon>
      <ItemLabel className="file-label">
        {entry.name}
        <span className="sr-only">
          {entry.kind === "directory" ? ", folder" : ", file"}
        </span>
      </ItemLabel>
      <ItemInput
        aria-label={`Rename ${entry.name}`}
        className={`file-input ${compact ? "compact" : ""}`}
      />
      <ItemStatus className="file-status">Saving…</ItemStatus>
    </ItemRoot>
  );
}
