import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "../app";
import "../styles.css";

const documentItem = page.getByRole("option", { name: /Document/ });
const photosItem = page.getByRole("option", { name: /Photos/ });
const notesItem = page.getByRole("option", { name: /notes.txt/ });
const desktop = page.getByRole("listbox", { name: "Files" });

beforeEach(async () => {
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await render(<App />);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function position(item: typeof documentItem) {
  const itemRect = item.element().getBoundingClientRect();
  const desktopRect = desktop.element().getBoundingClientRect();

  return {
    x: itemRect.left - desktopRect.left,
    y: itemRect.top - desktopRect.top,
  };
}

async function selectTwoItems() {
  await documentItem.click();
  await photosItem.click({ modifiers: ["ControlOrMeta"] });
}

test("layout omits the status message and header item count", async () => {
  await expect.element(page.getByRole("status")).not.toBeInTheDocument();
  await expect
    .element(page.getByText("3 items", { exact: true }))
    .not.toBeInTheDocument();
});

describe("Selection", () => {
  test("click selects one item", async () => {
    await photosItem.click();

    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
  });

  test("clicking empty desktop space clears the selection", async () => {
    await selectTwoItems();

    await desktop.click({ position: { x: 600, y: 200 } });

    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("plain click replaces a multiple selection", async () => {
    await selectTwoItems();

    await notesItem.click();

    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("Cmd or Ctrl click adds an item to selection", async () => {
    await documentItem.click();

    await photosItem.click({ modifiers: ["ControlOrMeta"] });

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("Cmd or Ctrl click removes an item from selection", async () => {
    await selectTwoItems();

    await photosItem.click({ modifiers: ["ControlOrMeta"] });

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("Shift click selects the range", async () => {
    await documentItem.click();

    await notesItem.click({ modifiers: ["Shift"] });

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
  });

  test("Shift arrow extends selection", async () => {
    await documentItem.click();

    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveFocus();
  });

  test("Space toggles the focused item", async () => {
    await documentItem.click();
    await userEvent.keyboard("{ArrowRight}");

    await userEvent.keyboard(" ");

    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
  });

  test("Cmd or Ctrl A selects every item", async () => {
    await documentItem.click();

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
  });

  test("the desktop is ready for Ctrl or Cmd A immediately after loading", async () => {
    await expect.element(documentItem).toHaveFocus();

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    expect(window.getSelection()?.toString()).toBe("");
  });

  test("Ctrl or Cmd A after a header click selects files instead of page text", async () => {
    await page.getByRole("heading", { name: "Desktop", exact: true }).click();

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    expect(window.getSelection()?.toString()).toBe("");
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("repeated Ctrl or Cmd A keeps files selected and clears existing page text selection", async () => {
    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
    window
      .getSelection()
      ?.selectAllChildren(
        page.getByRole("heading", { name: "Desktop", exact: true }).element(),
      );
    expect(window.getSelection()?.toString()).toBe("Desktop");

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    expect(window.getSelection()?.toString()).toBe("");
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
  });

  test("Ctrl or Cmd A on a focused item does not select page text", async () => {
    await documentItem.click();

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    expect(window.getSelection()?.toString()).toBe("");
  });

  test("Ctrl or Cmd A after clicking a filename selects items instead of text", async () => {
    await page.getByText(/Document/).click();

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    expect(window.getSelection()?.toString()).toBe("");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("Ctrl or Cmd A on the desktop surface selects items instead of text", async () => {
    await desktop.click({ position: { x: 600, y: 200 } });

    await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

    expect(window.getSelection()?.toString()).toBe("");
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("Escape clears selection", async () => {
    await selectTwoItems();

    await userEvent.keyboard("{Escape}");

    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });
});

describe("Keyboard focus", () => {
  test("Right arrow moves focus to the item on the right", async () => {
    await documentItem.click();

    await userEvent.keyboard("{ArrowRight}");

    await expect.element(photosItem).toHaveFocus();
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("Left arrow moves focus to the item on the left", async () => {
    await photosItem.click();

    await userEvent.keyboard("{ArrowLeft}");

    await expect.element(documentItem).toHaveFocus();
  });

  test("Home focuses the first item", async () => {
    await notesItem.click();

    await userEvent.keyboard("{Home}");

    await expect.element(documentItem).toHaveFocus();
  });

  test("End focuses the last item", async () => {
    await documentItem.click();

    await userEvent.keyboard("{End}");

    await expect.element(notesItem).toHaveFocus();
  });

  test("typing an item name moves focus without selecting it", async () => {
    await documentItem.click();

    await userEvent.keyboard("notes");

    await expect.element(notesItem).toHaveFocus();
    await expect.element(notesItem).toHaveAttribute("aria-selected", "false");
  });

  test("Tab leaves the list instead of visiting every item", async () => {
    await documentItem.click();

    await userEvent.tab();

    await expect.element(documentItem).not.toHaveFocus();
    await expect.element(photosItem).not.toHaveFocus();
    await expect.element(notesItem).not.toHaveFocus();
  });
});

describe("Opening and renaming items", () => {
  test("Enter edits the single selected folder", async () => {
    await photosItem.click();

    await userEvent.keyboard("{Enter}");

    await expect
      .element(page.getByRole("textbox", { name: "Rename Photos" }))
      .toHaveFocus();
  });

  test("clicking empty desktop space cancels the rename", async () => {
    await documentItem.click();
    await userEvent.keyboard("{Enter}");
    await page
      .getByRole("textbox", { name: "Rename Document" })
      .fill("Discarded.txt");

    await desktop.click({ position: { x: 600, y: 200 } });

    await expect.element(documentItem).toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("option", { name: /Discarded.txt/ }))
      .not.toBeInTheDocument();
  });

  test("clicking outside the desktop cancels the rename", async () => {
    await documentItem.click();
    await userEvent.keyboard("{Enter}");
    await page
      .getByRole("textbox", { name: "Rename Document" })
      .fill("Discarded.txt");

    await page.getByRole("heading", { name: "Desktop" }).click();

    await expect.element(documentItem).toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("option", { name: /Discarded.txt/ }))
      .not.toBeInTheDocument();
  });

  test("saving a name updates the item in App", async () => {
    await photosItem.click();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("Pictures");

    await userEvent.keyboard("{Enter}");

    await expect
      .element(page.getByRole("option", { name: /Pictures/ }))
      .toHaveFocus();
    await expect.element(photosItem).not.toBeInTheDocument();
  });

  test("a duplicate name is rejected by App and the old name is restored", async () => {
    await documentItem.click();
    await userEvent.keyboard("{Enter}");
    await page.getByRole("textbox", { name: "Rename Document" }).fill("Photos");

    await userEvent.keyboard("{Enter}");

    await expect.element(documentItem).toBeVisible();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith(
      "Could not rename to “Photos”. The original name was restored.",
    );
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Context menu", () => {
  test("right click preserves a selected group", async () => {
    await selectTwoItems();

    await documentItem.click({ button: "right" });

    await expect
      .element(page.getByRole("menu", { name: "File actions" }))
      .toBeVisible();
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("right click on an unselected item replaces the selection", async () => {
    await selectTwoItems();

    await notesItem.click({ button: "right" });

    await expect
      .element(page.getByRole("menuitem", { name: "Open", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("menuitem", { name: "Rename", exact: true }))
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
  });

  test("Escape closes the menu and restores trigger focus", async () => {
    await documentItem.click({ button: "right" });

    await userEvent.keyboard("{Escape}");

    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(documentItem).toHaveFocus();
  });
});

describe("Movement", () => {
  test.each([false, true])(
    "drag copies move while originals stay put (cancel: %s)",
    async (cancel) => {
      await selectTwoItems();
      const original = documentItem.element().getBoundingClientRect();

      await commands.dragPointer(
        { x: 30, y: 30 },
        { x: 150, y: 110 },
        false,
        true,
      );

      try {
        const copies = document.querySelectorAll<HTMLElement>(
          "[data-drag-preview]",
        );
        expect(copies).toHaveLength(2);
        expect(position(documentItem)).toEqual({ x: 20, y: 20 });
        expect(position(photosItem)).toEqual({ x: 180, y: 20 });
        expect(copies[0].getBoundingClientRect().left).toBeCloseTo(
          original.left + 120,
        );
        expect(copies[0].getBoundingClientRect().top).toBeCloseTo(
          original.top + 80,
        );
        expect(
          copies[1].getBoundingClientRect().left -
            copies[0].getBoundingClientRect().left,
        ).toBe(160);
        expect(copies[0].getAttribute("aria-hidden")).toBe("true");
        expect(getComputedStyle(copies[0]).pointerEvents).toBe("none");
        expect(getComputedStyle(copies[0]).opacity).toBe("0.75");
        expect(getComputedStyle(documentItem.element()).opacity).toBe("1");

        if (cancel) await userEvent.keyboard("{Escape}");
      } finally {
        await commands.releasePointer();
      }

      expect(document.querySelectorAll("[data-drag-preview]")).toHaveLength(0);
      expect(position(documentItem)).toEqual(
        cancel ? { x: 20, y: 20 } : { x: 140, y: 100 },
      );
      expect(position(photosItem)).toEqual(
        cancel ? { x: 180, y: 20 } : { x: 300, y: 100 },
      );
    },
  );

  test("dragging moves an item to its dropped position", async () => {
    await commands.dragPointer({ x: 30, y: 30 }, { x: 150, y: 110 });

    await expect.poll(() => position(documentItem)).toEqual({ x: 140, y: 100 });
  });

  test("dragging a selected item moves the selected group", async () => {
    await selectTwoItems();

    await commands.dragPointer({ x: 30, y: 30 }, { x: 150, y: 110 });

    await expect.poll(() => position(documentItem)).toEqual({ x: 140, y: 100 });
    await expect.poll(() => position(photosItem)).toEqual({ x: 300, y: 100 });
    expect(position(notesItem)).toEqual({ x: 340, y: 20 });
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("dragging an unselected item moves it alone", async () => {
    await documentItem.click();

    await commands.dragPointer({ x: 190, y: 30 }, { x: 310, y: 110 });

    await expect.poll(() => position(photosItem)).toEqual({ x: 300, y: 100 });
    expect(position(documentItem)).toEqual({ x: 20, y: 20 });
    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("Escape during a drag restores the original positions", async () => {
    await selectTwoItems();

    await commands.dragPointer({ x: 30, y: 30 }, { x: 150, y: 110 }, true);

    await expect.poll(() => position(documentItem)).toEqual({ x: 20, y: 20 });
    await expect.poll(() => position(photosItem)).toEqual({ x: 180, y: 20 });
    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
  });

  test("dropping at the top-left edge keeps the group inside the desktop", async () => {
    await selectTwoItems();

    await commands.dragPointer({ x: 30, y: 30 }, { x: 0, y: 0 });

    await expect.poll(() => position(documentItem)).toEqual({ x: 0, y: 0 });
    await expect.poll(() => position(photosItem)).toEqual({ x: 160, y: 0 });
  });

  test("dropping at the bottom-right edge preserves group spacing", async () => {
    await selectTwoItems();
    const desktopRect = desktop.element().getBoundingClientRect();
    const itemRect = photosItem.element().getBoundingClientRect();

    await commands.dragPointer(
      { x: 30, y: 30 },
      { x: desktopRect.width - 1, y: desktopRect.height - 1 },
    );

    const expected = {
      x: desktopRect.width - itemRect.width,
      y: desktopRect.height - itemRect.height,
    };
    await expect.poll(() => position(photosItem)).toEqual(expected);
    await expect
      .poll(() => position(documentItem))
      .toEqual({ x: expected.x - 160, y: expected.y });
  });
});

describe("Lasso", () => {
  test("dragging empty space selects items with a lasso", async () => {
    await commands.dragPointer({ x: 5, y: 5 }, { x: 320, y: 70 });

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "false");
  });

  test("Shift lasso adds items to the existing selection", async () => {
    await notesItem.click();
    await userEvent.keyboard("{Shift>}");

    await commands.dragPointer({ x: 5, y: 5 }, { x: 320, y: 70 });
    await userEvent.keyboard("{/Shift}");

    await expect.element(documentItem).toHaveAttribute("aria-selected", "true");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "true");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
  });

  test("Escape cancels lasso without changing the original selection", async () => {
    await notesItem.click();

    await commands.dragPointer({ x: 5, y: 5 }, { x: 320, y: 70 }, true);

    await expect
      .element(documentItem)
      .toHaveAttribute("aria-selected", "false");
    await expect.element(photosItem).toHaveAttribute("aria-selected", "false");
    await expect.element(notesItem).toHaveAttribute("aria-selected", "true");
  });
});
