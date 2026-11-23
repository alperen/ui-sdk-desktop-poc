import { createContext, type ReactNode, use } from "react";
import type { FileEntry } from "../models/file-entry";
import { useItems } from "../hooks/use-items";
import { useRenameItems } from "../hooks/use-rename-items";

type FileListState = {
  items: FileEntry[];
  rename: (id: string, name: string) => void;
};

export const FileListContext = createContext<FileListState | null>(null);

export function FileListProvider({ children }: { children: ReactNode }) {
  const { items, setItems } = useItems();
  const { rename } = useRenameItems(items, setItems);

  return (
    <FileListContext value={{ items, rename }}>{children}</FileListContext>
  );
}

export function useFileList() {
  const context = use(FileListContext);
  if (!context) throw new Error("useFileList requires FileListProvider");

  return context;
}
