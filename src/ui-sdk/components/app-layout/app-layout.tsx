import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="relative flex h-dvh min-h-120 flex-col bg-background text-sm text-foreground antialiased">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 grid-cols-2 gap-1 p-1 text-primary"
          >
            <span className="bg-current" />
            <span className="bg-current opacity-40" />
            <span className="bg-current opacity-40" />
            <span className="bg-current" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-semibold tracking-tight">Desktop</h1>
            <p className="text-xs text-muted-foreground">Personal workspace</p>
          </div>
        </div>
      </header>
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-contain">
        {children}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3 text-xs text-muted-foreground sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <kbd>Enter</kbd> Rename
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>F2</kbd> Rename
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>Space</kbd> Select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>Esc</kbd> Clear
          </span>
        </div>
      </footer>
    </main>
  );
}
