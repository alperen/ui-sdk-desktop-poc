import type { Dispatch, SetStateAction } from "react";
import type { FileEntry } from "../models/file-entry";

export function useRenameItems(
  items: FileEntry[],
  setItems: Dispatch<SetStateAction<FileEntry[]>>,
) {
  function rename(id: string, name: string) {
    const target = items.find((entry) => entry.id === id);
    if (!target) return;

    if (
      !name.trim() ||
      items.some(
        (entry) =>
          entry.id !== id &&
          entry.parentId === target.parentId &&
          entry.name === name,
      )
    ) {
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
