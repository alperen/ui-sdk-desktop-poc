import { createContext, type ReactNode, useContext } from "react";
import { useItems } from "../hooks/use-items";
import { useRenameItems } from "../hooks/use-rename-items";
import type { FileEntry } from "../models/file-entry";

export const FileListContext = createContext<{
  items: FileEntry[];
  rename: (id: string, name: string) => void;
} | null>(null);

export function useFileList() {
  const context = useContext(FileListContext);
  if (!context) throw new Error("Missing FileListProvider");
  return context;
}

export function FileListProvider({ children }: { children: ReactNode }) {
  const { items, setItems } = useItems();
  const { rename } = useRenameItems(items, setItems);
  return (
    <FileListContext value={{ items, rename }}>{children}</FileListContext>
  );
}
