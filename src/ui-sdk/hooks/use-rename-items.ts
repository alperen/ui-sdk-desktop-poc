import type { Dispatch, SetStateAction } from "react";
import type { FileEntry } from "../models/file-entry";

export function useRenameItems(
  items: FileEntry[],
  setItems: Dispatch<SetStateAction<FileEntry[]>>,
) {
  function rename(id: string, name: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    const duplicate = items.some(
      (entry) =>
        entry.id !== id &&
        entry.parentId === item.parentId &&
        entry.name === name,
    );
    if (!name.trim() || duplicate) {
      window.alert(
        `Could not rename to “${name}”. The original name was restored.`,
      );
      return;
    }

    setItems((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
    );
  }

  return { rename };
}
