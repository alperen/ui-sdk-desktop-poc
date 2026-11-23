import { FileListView, type MenuAction } from "./components/file-list-view/file-list-view";
import { Item } from "./components/item/item";
import { FileListProvider, useFileList } from "./contexts/file-list-context";
import { useWindows } from "./hooks/use-windows";
import { Window } from "./components/window/window";

function Desktop() {
  const { items } = useFileList();
  const manager = useWindows(items);
  function menuAction(action: MenuAction) {
    if (action.type === "open") manager.openWindow(action.id);
    else manager.openWindows(action.ids);
  }
  return (
    <main className="desktop-app">
      <header className="app-header">
        <div className="brand">
          <span aria-hidden="true" className="brand-icon">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div className="brand-text">
            <h1>Desktop</h1>
            <p>Personal workspace</p>
          </div>
        </div>
      </header>
      <div className="workspace">
        <FileListView
          items={items.filter((entry) => entry.parentId === null)}
          layout="spatial"
          active={manager.activeWindowId === null}
          onActivate={() => manager.focusWindow(null)}
          defaultPositions={{
            document: { x: 20, y: 20 },
            photos: { x: 180, y: 20 },
            "notes.txt": { x: 340, y: 20 },
          }}
          onOpen={manager.openWindow}
          onMenuAction={menuAction}
          renderItem={(entry) => <Item entry={entry} />}
        />
        {manager.windows.map((entry, index) => {
          const item = items.find((item) => item.id === entry.id);
          if (!item) return null;
          return (
            <Window
              key={entry.id}
              item={item}
              attention={entry.attention}
              zIndex={entry.zIndex}
              active={manager.activeWindowId === entry.id}
              defaultPosition={{ x: 80 + index * 32, y: 160 + index * 32 }}
              onActivate={manager.focusWindow}
              onClose={manager.closeWindow}
              onOpen={manager.openWindow}
              openWindows={manager.openWindows}
            />
          );
        })}
      </div>
      <footer className="app-footer">
        <div>
          {[
            ["Enter", "Rename"],
            ["F2", "Rename"],
            ["Space", "Select"],
            ["Esc", "Clear"],
          ].map(([key, action]) => (
            <span key={key}>
              <kbd>{key}</kbd> {action}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}

export function App() {
  return (
    <FileListProvider>
      <Desktop />
    </FileListProvider>
  );
}
