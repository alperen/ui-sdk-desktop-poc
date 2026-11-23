import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "../app";
import { ColumnView } from "../components/column-view/column-view";
import { FileListContext } from "../contexts/file-list-context";
import { FileListView } from "../components/file-list-view/file-list-view";
import "../styles.css";

test("columns compose folders, navigate with arrows, rename and collapse on a file", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();

  const photos = page.getByRole("listbox", { name: "Photos contents" });
  const trips = photos.getByRole("option", { name: /Trips/ });
  await trips.click();

  const children = page.getByRole("listbox", { name: "Trips contents" });
  const file = children.getByRole("option", { name: /Itinerary.txt/ });
  await expect.element(children).toBeVisible();
  await expect.element(trips).toHaveFocus();

  await userEvent.keyboard("{ArrowRight}");
  await expect.element(file).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(file).toHaveFocus();
  await userEvent.keyboard("{F2}Cancelled.txt{ArrowLeft}{Escape}");
  await expect.element(file).toBeVisible();
  await userEvent.keyboard("{F2}Plan.txt{Enter}");
  await expect
    .element(children.getByRole("option", { name: /Plan.txt/ }))
    .toBeVisible();

  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(trips).toHaveFocus();
  await userEvent.keyboard("{ArrowUp}");
  await expect
    .element(photos.getByRole("option", { name: /Sunset.jpg/ }))
    .toHaveFocus();
  await expect.element(children).not.toBeInTheDocument();
  await trips.click();
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(children.getByRole("option", { name: /Plan.txt/ }))
    .toHaveFocus();

  await page.getByRole("radio", { name: "Grid view" }).click();
  await expect.element(photos).toBeVisible();
  await page.getByRole("radio", { name: "List view" }).click();
  await expect.element(photos).toBeVisible();
});

test("empty columns retain a focus target and let Left return to the parent", async () => {
  const root = {
    id: "root",
    name: "Root",
    kind: "directory" as const,
    parentId: null,
  };
  const empty = {
    id: "empty",
    name: "Empty",
    kind: "directory" as const,
    parentId: "root",
  };
  await render(
    <FileListContext value={{ items: [root, empty], rename: () => {} }}>
      <ColumnView
        root={root}
        items={[root, empty]}
        active
        onOpen={() => {}}
        onMenuAction={() => {}}
      />
      ,
    </FileListContext>,
  );
  const folder = page.getByRole("option", { name: /Empty/ });
  await folder.click();
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(page.getByRole("listbox", { name: "Empty contents" }))
    .toHaveFocus();
  await expect.element(page.getByText("No files here.")).toBeVisible();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(folder).toHaveFocus();
});

test("returning through ancestor columns preserves the branch until another item is chosen", async () => {
  const root = {
    id: "root",
    name: "Root",
    kind: "directory" as const,
    parentId: null,
  };
  const items = [
    root,
    { id: "a", name: "A", kind: "directory" as const, parentId: "root" },
    { id: "b", name: "B", kind: "directory" as const, parentId: "a" },
    { id: "c", name: "C", kind: "directory" as const, parentId: "b" },
    { id: "file", name: "File", kind: "file" as const, parentId: "root" },
  ];
  await render(
    <FileListContext value={{ items: items, rename: () => {} }}>
      <ColumnView
        root={root}
        items={items}
        active
        onOpen={() => {}}
        onMenuAction={() => {}}
      />
      ,
    </FileListContext>,
  );
  await page.getByRole("option", { name: "A , folder", exact: true }).click();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
  await expect
    .element(page.getByRole("listbox", { name: "C contents" }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
  await expect
    .element(page.getByRole("option", { name: "A , folder", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("listbox", { name: "C contents" }))
    .toBeVisible();
  await userEvent.keyboard("{ArrowDown}");
  await expect
    .element(page.getByRole("option", { name: "File , file", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("listbox", { name: "A contents" }))
    .not.toBeInTheDocument();
});

test("column modifier clicks preserve multi-selection", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  const beach = page.getByRole("option", { name: /Beach.jpg/ });
  const mountains = page.getByRole("option", { name: /Mountains.jpg/ });
  await beach.click();
  await mountains.click({ modifiers: ["ControlOrMeta"] });
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
});

test("demo folders show a deep branch and scroll keyboard focus into view", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  const window = page.getByRole("region", { name: "Photos", exact: true });
  const rect = window.element().getBoundingClientRect();
  expect(rect.width).toBe(800);
  expect(rect.height).toBe(360);
  await page.getByRole("radio", { name: "Columns view" }).click();
  await page.getByRole("option", { name: /Trips/ }).click();
  await userEvent.keyboard("{ArrowRight}{ArrowDown}");
  await expect
    .element(page.getByRole("option", { name: /2026/ }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
  const photo = page.getByRole("option", { name: /Galata.jpg/ });
  await expect.element(photo).toHaveFocus();
  const photoRect = photo.element().getBoundingClientRect();
  expect(photoRect.left).toBeGreaterThanOrEqual(rect.left);
  expect(photoRect.right).toBeLessThanOrEqual(rect.right);
  await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowDown}");
  await expect
    .element(page.getByRole("option", { name: /Unsorted/ }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(page.getByRole("listbox", { name: "Unsorted contents" }))
    .toHaveFocus();
});

test("clicking deep folders reveals each new column without moving focus", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  const window = page.getByRole("region", { name: "Photos", exact: true });

  for (const [name, child] of [
    ["Trips", "Trips contents"],
    ["2026", "2026 contents"],
    ["Turkey", "Turkey contents"],
    ["Istanbul", "Istanbul contents"],
    ["Day 1", "Day 1 contents"],
  ]) {
    const folder = page.getByRole("option", {
      name: `${name} , folder`,
      exact: true,
    });
    await folder.click();
    await expect.element(folder).toHaveFocus();
    const column = page
      .getByRole("listbox", { name: child })
      .element()
      .getBoundingClientRect();
    const bounds = window.element().getBoundingClientRect();
    expect(column.left).toBeGreaterThanOrEqual(bounds.left);
    expect(column.right).toBeLessThanOrEqual(bounds.right);
  }

  await page.getByRole("option", { name: /Galata.jpg/ }).click();
  for (const name of ["Trips", "2026", "Turkey", "Istanbul", "Day 1"]) {
    await expect
      .element(
        page.getByRole("option", { name: `${name} , folder`, exact: true }),
      )
      .toHaveAttribute("aria-selected", "true");
  }
});

test("Columns contexts Open opens a separate window", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  await page.getByRole("option", { name: /Trips/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open", exact: true }).click();
  await expect
    .element(page.getByRole("region", { name: "Trips", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("region", { name: "Photos", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Close Trips", exact: true }).click();
  await page.getByRole("radio", { name: "List view" }).click();
  await page.getByRole("option", { name: /Trips/ }).click({ button: "right" });
  await expect
    .element(page.getByRole("menuitem", { name: "Open", exact: true }))
    .toBeVisible();
  await userEvent.keyboard("{Escape}");
});

test("menu actions report one id or all selected ids in one callback", async () => {
  const onMenuAction = vi.fn();
  const items = [
    { id: "a", name: "A", kind: "file" as const, parentId: null },
    { id: "b", name: "B", kind: "file" as const, parentId: null },
  ];
  await render(
    <FileListView
      items={items}
      layout="vertical"
      active
      label="Actions"
      onOpen={() => {}}
      onMenuAction={onMenuAction}
      renderItem={(item) => item.name}
    />,
  );
  const first = page.getByRole("option", { name: "A", exact: true });
  const second = page.getByRole("option", { name: "B", exact: true });
  await first.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open", exact: true }).click();
  expect(onMenuAction).toHaveBeenLastCalledWith({ type: "open", id: "a" });
  await first.click();
  await second.click({ modifiers: ["ControlOrMeta"] });
  await first.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open (2)", exact: true }).click();
  expect(onMenuAction).toHaveBeenLastCalledWith({
    type: "open-all",
    ids: ["a", "b"],
  });
  expect(onMenuAction).toHaveBeenCalledTimes(2);
});

test("focus alone leaves selection intact; navigation and modifier presses own selection", async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  const beach = page.getByRole("option", { name: /Beach.jpg/ });
  const mountains = page.getByRole("option", { name: /Mountains.jpg/ });
  const sunset = page.getByRole("option", { name: /Sunset.jpg/ });
  await beach.click();
  mountains.element().focus();
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "false");
  await mountains.click({ modifiers: ["ControlOrMeta"] });
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  await mountains.click({ modifiers: ["ControlOrMeta"] });
  await expect.element(mountains).toHaveAttribute("aria-selected", "false");
  await beach.click();
  await sunset.click({ modifiers: ["Shift"] });
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  await expect.element(sunset).toHaveAttribute("aria-selected", "true");
  await beach.click();
  await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  await expect.element(sunset).toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{ArrowUp}");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  await expect.element(beach).toHaveAttribute("aria-selected", "false");
  await expect.element(sunset).toHaveAttribute("aria-selected", "false");
});

test("column navigation follows RTL and leaves modified arrows to the list", async () => {
  await render(
    <div dir="rtl">
      <App />
    </div>,
  );
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  const trips = page.getByRole("option", { name: /Trips/ });
  await trips.click();
  await userEvent.keyboard("{Control>}{ArrowLeft}{/Control}");
  await expect.element(trips).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  const file = page.getByRole("option", { name: /Itinerary.txt/ });
  await expect.element(file).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(trips).toHaveFocus();
});

test("removing the focused child column returns focus to the remaining list", async () => {
  const root = {
    id: "root",
    name: "Root",
    kind: "directory" as const,
    parentId: null,
  };
  const items = [
    root,
    {
      id: "child",
      name: "Child",
      kind: "directory" as const,
      parentId: "root",
    },
    { id: "file", name: "File", kind: "file" as const, parentId: "child" },
  ];
  const view = (entries: typeof items) => (
    <FileListContext value={{ items: entries, rename: () => {} }}>
      <ColumnView
        root={root}
        items={entries}
        active
        onOpen={() => {}}
        onMenuAction={() => {}}
      />
    </FileListContext>
  );
  const rendered = await render(view(items));
  await page.getByRole("option", { name: /Child/ }).click();
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(page.getByRole("option", { name: /File/ }))
    .toHaveFocus();
  await rendered.rerender(view([root]));
  await expect
    .element(page.getByRole("listbox", { name: "Root contents" }))
    .toHaveFocus();
});

test.each(["toString", "constructor", "__proto__"])(
  "column controllers accept folder id %s",
  async (id) => {
    const root = {
      id: "root",
      name: "Root",
      kind: "directory" as const,
      parentId: null,
    };
    const items = [
      root,
      { id, name: "Child", kind: "directory" as const, parentId: "root" },
      { id: "file", name: "File", kind: "file" as const, parentId: id },
    ];
    await render(
      <FileListContext value={{ items, rename: () => {} }}>
        <ColumnView
          root={root}
          items={items}
          active
          onOpen={() => {}}
          onMenuAction={() => {}}
        />
      </FileListContext>,
    );
    await page.getByRole("option", { name: /Child/ }).click();
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .element(page.getByRole("option", { name: /File/ }))
      .toHaveFocus();
  },
);

test("changing the root creates a new column browser with working return navigation", async () => {
  const first = {
    id: "first",
    name: "First",
    kind: "directory" as const,
    parentId: null,
  };
  const second = { ...first, id: "second", name: "Second" };
  const items = [
    first,
    second,
    {
      id: "child",
      name: "Child",
      kind: "directory" as const,
      parentId: "second",
    },
    { id: "file", name: "File", kind: "file" as const, parentId: "child" },
  ];
  const view = (root: typeof first) => (
    <FileListContext value={{ items, rename: () => {} }}>
      <ColumnView
        root={root}
        items={items}
        active
        onOpen={() => {}}
        onMenuAction={() => {}}
      />
    </FileListContext>
  );
  const rendered = await render(view(first));
  await rendered.rerender(view(second));
  const child = page.getByRole("option", { name: /Child/ });
  await child.click();
  await userEvent.keyboard("{ArrowRight}");
  await expect
    .element(page.getByRole("option", { name: /File/ }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(child).toHaveFocus();
});
