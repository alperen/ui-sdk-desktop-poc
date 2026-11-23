import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { FileEntry } from "../models/file-entry";
import { FileListContext } from "../contexts/file-list-context";
import { FileListView } from "../components/file-list-view/file-list-view";
import { createItemController } from "../primitives/item/item";
import {
  ItemIcon,
  ItemInput,
  ItemLabel,
  ItemRoot,
  ItemStatus,
} from "../primitives/item/item-parts";
import { Item } from "../components/item/item";
import { useItems } from "../hooks/use-items";
import { useRenameItems } from "../hooks/use-rename-items";

import "../styles.css";

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const initialItems: FileEntry[] = [
  { id: "document", name: "Document", kind: "file", parentId: null },
  { id: "photos", name: "Photos", kind: "directory", parentId: null },
];

const documentItem = page.getByRole("option", { name: /Document/ });
const photosItem = page.getByRole("option", { name: /Photos/ });
const editor = page.getByRole("textbox", { name: "Rename Document" });

interface RenameDesktopProps {
  onOpen?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}

function RenameDesktop({ onRename, onOpen = () => {} }: RenameDesktopProps) {
  const { items, setItems } = useItems(initialItems);
  const { rename } = useRenameItems(items, setItems);

  function handleRename(id: string, name: string) {
    onRename?.(id, name);
    rename(id, name);
  }

  return (
    <FileListContext value={{ items, rename: handleRename }}>
      <FileListView
        layout="spatial"
        active={true}
        items={items}
        defaultPositions={{
          document: { x: 20, y: 20 },
          photos: { x: 180, y: 20 },
        }}
        label="Files"
        onOpen={onOpen}
        onMenuAction={(action) => {
          if (action.type === "open") onOpen(action.id);
          else action.ids.forEach(onOpen);
        }}
        renderItem={(entry) => <Item entry={entry} />}
      />
    </FileListContext>
  );
}

async function startEditing() {
  await documentItem.click();
  await userEvent.keyboard("{Enter}");
}

test("an Item edits and commits without a List", async () => {
  const controller = createItemController();
  const rename = vi.fn();
  await render(
    <ItemRoot
      value="document"
      label="Document"
      controller={controller}
      onRename={rename}
    >
      <button type="button" onClick={() => controller.startEditing()}>
        Rename
      </button>
      <ItemLabel>Document</ItemLabel>
      <ItemInput aria-label="Rename Document" />
    </ItemRoot>,
  );
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await userEvent.keyboard("Report.txt");
  await expect
    .element(page.getByRole("textbox", { name: "Rename Document" }))
    .toHaveValue("Report.txt");

  await userEvent.keyboard("{Enter}");

  expect(rename).toHaveBeenCalledExactlyOnceWith("document", "Report.txt");
  await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: "Rename", exact: true }))
    .toHaveFocus();
});

test("a loading Item exposes its status to its rendered parts", async () => {
  await render(
    <ItemRoot value="document" label="Document" loading>
      <ItemIcon data-testid="file-icon">Icon</ItemIcon>
      <ItemLabel>Document</ItemLabel>
      <ItemStatus>
        {(state) => (state.loadingStatus === "loading" ? "Saving…" : "Ready")}
      </ItemStatus>
    </ItemRoot>,
  );

  await expect.element(page.getByRole("status")).toHaveTextContent("Saving…");
  await expect
    .element(page.getByRole("status"))
    .toHaveAttribute("data-loading-status", "loading");
  await expect
    .element(page.getByTestId("file-icon"))
    .toHaveAttribute("data-loading-status", "loading");
});

test("FileListView uses the supplied renderItem content", async () => {
  await render(
    <FileListView
      layout="spatial"
      active={true}
      items={[
        { id: "document", name: "Document", kind: "file", parentId: null },
      ]}
      defaultPositions={{ document: { x: 20, y: 20 } }}
      label="Files"
      onOpen={() => {}}
      onMenuAction={() => {}}
      renderItem={(entry) => <strong>Custom {entry.name}</strong>}
    />,
  );

  await expect
    .element(page.getByRole("option", { name: "Custom Document" }))
    .toBeVisible();
});

test("an empty desktop describes its content", async () => {
  await render(
    <FileListView
      layout="spatial"
      active={true}
      items={[]}
      defaultPositions={{}}
      label="Files"
      onOpen={() => {}}
      onMenuAction={() => {}}
      renderItem={() => null}
    />,
  );

  await expect.element(page.getByText("No files here.")).toBeVisible();
  await expect
    .element(page.getByRole("listbox", { name: "Files" }))
    .toHaveAccessibleDescription("No files here.");
});

describe("Inline rename", () => {
  test("Enter saves the edited name through React with the stable item ID", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("Report.txt");

    await expect.element(editor).toHaveValue("Report.txt");
    await userEvent.keyboard("{Enter}");

    expect(onRename).toHaveBeenCalledExactlyOnceWith("document", "Report.txt");
    await expect
      .element(page.getByRole("option", { name: /Report.txt/ }))
      .toHaveFocus();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("typing spaces and Backspace edits the draft without changing selection", async () => {
    await render(<RenameDesktop />);
    await startEditing();
    const selectedItem = documentItem.element();

    await userEvent.keyboard("My report.txt{End}{Backspace}");

    await expect.element(editor).toHaveValue("My report.tx");
    await expect.element(editor).toHaveFocus();
    await expect.element(selectedItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("Ctrl or Cmd A selects input text without selecting other items", async () => {
    await render(<RenameDesktop />);
    await startEditing();
    await userEvent.keyboard("Report.txt");

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
    await userEvent.keyboard("Notes.txt");

    await expect.element(editor).toHaveValue("Notes.txt");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("editor keystrokes do not reach parent components", async () => {
    const keydown = vi.fn();
    const keyup = vi.fn();
    await render(
      <fieldset onKeyDown={keydown} onKeyUp={keyup}>
        <RenameDesktop />
      </fieldset>,
    );
    await startEditing();
    keydown.mockClear();
    keyup.mockClear();

    await userEvent.keyboard(
      "Report.txt{ControlOrMeta>}a{/ControlOrMeta}Notes.txt",
    );

    await expect.element(editor).toHaveValue("Notes.txt");
    expect(keydown).not.toHaveBeenCalled();
    expect(keyup).not.toHaveBeenCalled();
  });

  test("Escape cancels without sending a rename to React", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("Discarded.txt");

    await userEvent.keyboard("{Escape}");

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(documentItem).toHaveFocus();
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("Enter does not edit a multiple selection", async () => {
    await render(<RenameDesktop />);
    await documentItem.click();
    await photosItem.click({ modifiers: ["ControlOrMeta"] });

    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("Enter does not edit when nothing is selected", async () => {
    await render(<RenameDesktop />);
    await documentItem.click();
    await userEvent.keyboard("{Escape}");

    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("Enter edits the selected item even when focus is on another item", async () => {
    await render(<RenameDesktop />);
    await documentItem.click();
    await userEvent.keyboard("{ArrowRight}");

    await userEvent.keyboard("{Enter}");

    await expect.element(editor).toHaveFocus();
    await expect.element(editor).toHaveValue("Document");
  });

  test("blank names keep the editor open without saving", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("   ");

    await userEvent.keyboard("{Enter}");

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(editor).toHaveFocus();
  });

  test("clicking another item cancels the rename", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("Report.txt");

    await photosItem.click();

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(documentItem).toBeVisible();
    await expect.element(photosItem).toHaveFocus();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("clicking inside the editor keeps the draft", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("Report.txt");

    await editor.click();

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(editor).toHaveFocus();
    await expect.element(editor).toHaveValue("Report.txt");
  });

  test("Tab cancels the rename without saving", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("Report.txt");

    await userEvent.tab();

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(documentItem).toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });

  test("each invalid rename shows a native alert without changing the name", async () => {
    await render(<RenameDesktop />);

    for (let attempt = 0; attempt < 2; attempt++) {
      await startEditing();
      await userEvent.keyboard("Photos{Enter}");
      await expect.element(documentItem).toBeVisible();
    }

    expect(window.alert).toHaveBeenCalledTimes(2);
  });

  test("IME confirmation does not save unfinished text", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("資料");

    editor.element().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(editor).toHaveFocus();
  });

  test("Safari IME confirmation does not save unfinished text", async () => {
    const onRename = vi.fn();
    await render(<RenameDesktop onRename={onRename} />);
    await startEditing();
    await userEvent.keyboard("資料");

    editor.element().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onRename).not.toHaveBeenCalled();
    await expect.element(editor).toHaveFocus();
  });
});

describe("Desktop commands", () => {
  test("double click opens the clicked item", async () => {
    const open = vi.fn();
    await render(<RenameDesktop onOpen={open} />);

    await photosItem.dblClick();

    expect(open).toHaveBeenCalledExactlyOnceWith(
      "photos",
      expect.objectContaining({ reason: "item-press" }),
    );
  });

  test("menu Open opens the target item", async () => {
    const open = vi.fn();
    await render(<RenameDesktop onOpen={open} />);
    await photosItem.click({ button: "right" });

    await page.getByRole("menuitem", { name: "Open", exact: true }).click();

    expect(open).toHaveBeenCalledExactlyOnceWith("photos");
  });
});
