import { AppLayout } from "./components/app-layout/app-layout";
import { FileListProvider, useFileList } from "./contexts/file-list-context";
import {
  useWindowManager,
  WindowManagerProvider,
} from "./contexts/window-manager-context";
import { FileListView, type MenuAction } from "./components/file-list-view/file-list-view";
import { Item } from "./components/item/item";
import { Window } from "./components/window/window";

const positions = {
  document: { x: 20, y: 20 },
  photos: { x: 180, y: 20 },
  "notes.txt": { x: 340, y: 20 },
};

function Workspace() {
  const { items } = useFileList();
  const { windows, activeWindowId, openWindow, openWindows, focusWindow } =
    useWindowManager();

  function handleMenuAction(action: MenuAction) {
    if (action.type === "open") {
      openWindow(action.id);
      return;
    }

    if (action.type === "open-all") {
      openWindows(action.ids);
      return;
    }
  }

  const desktopActive = activeWindowId === null;
  const rootItems = items.filter((item) => item.parentId === null);

  return (
    <AppLayout>
      <FileListView
        layout="spatial"
        items={rootItems}
        active={desktopActive}
        onActivate={() => focusWindow(null)}
        defaultPositions={positions}
        onOpen={openWindow}
        onMenuAction={handleMenuAction}
        renderItem={(entry) => <Item entry={entry} />}
      />

      {windows.map(({ id, attention, zIndex }, index) => {
        const item = items.find((entry) => entry.id === id);
        if (!item) return null;

        return (
          <Window
            key={id}
            item={item}
            attention={attention}
            zIndex={zIndex}
            defaultPosition={{ x: 80 + index * 32, y: 160 + index * 32 }}
          />
        );
      })}
    </AppLayout>
  );
}

export function App() {
  return (
    <FileListProvider>
      <WindowManagerProvider>
        <Workspace />
      </WindowManagerProvider>
    </FileListProvider>
  );
}
