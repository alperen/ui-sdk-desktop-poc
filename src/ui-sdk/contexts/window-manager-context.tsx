import { createContext, type ReactNode, use } from "react";
import { useWindows } from "../hooks/use-windows";
import { useFileList } from "./file-list-context";

export const WindowManagerContext = createContext<ReturnType<
  typeof useWindows
> | null>(null);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const { items } = useFileList();
  const manager = useWindows(items);

  return (
    <WindowManagerContext value={manager}>{children}</WindowManagerContext>
  );
}

export function useWindowManager() {
  const context = use(WindowManagerContext);
  if (!context)
    throw new Error("useWindowManager requires WindowManagerProvider");

  return context;
}
