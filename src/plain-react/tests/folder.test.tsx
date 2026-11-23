import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "../app";
import { createAgent } from "../agent";
import "../styles.css";

test("a folder lists its children in fixed rows and opens files in separate windows", async () => {
  await render(<App />);

  const desktop = page.getByRole("listbox", { name: "Files", exact: true });

  await desktop.getByRole("option", { name: /Photos/ }).dblClick();

  const folder = page.getByRole("listbox", { name: "Photos contents" });
  await expect.element(folder).toBeVisible();
  const first = folder.getByRole("option", { name: /Beach.jpg/ });
  const second = folder.getByRole("option", { name: /Mountains.jpg/ });
  await expect.element(first).toBeVisible();
  const firstRect = first.element().getBoundingClientRect();
  const secondRect = second.element().getBoundingClientRect();
  expect(secondRect.top).toBe(firstRect.bottom);
  expect(secondRect.left).toBe(firstRect.left);

  await first.dblClick();

  await expect
    .element(page.getByRole("region", { name: "Beach.jpg", exact: true }))
    .toBeVisible();
  await expect.element(folder).toBeVisible();
});

test("selection shortcuts stay with the active list", async () => {
  await render(<App />);

  const desktop = page.getByRole("listbox", { name: "Files", exact: true });
  const photos = desktop.getByRole("option", { name: /Photos/ });
  const document = desktop.getByRole("option", { name: /Document/ });

  await photos.dblClick();

  const folder = page.getByRole("listbox", { name: "Photos contents" });
  const beach = folder.getByRole("option", { name: /Beach.jpg/ });
  const mountains = folder.getByRole("option", { name: /Mountains.jpg/ });
  await expect.element(beach).toHaveFocus();

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  await expect.element(document).toHaveAttribute("aria-selected", "false");
  await expect.element(photos).toHaveAttribute("aria-selected", "true");

  await page.getByRole("heading", { name: "Desktop", exact: true }).click();

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect.element(beach).toHaveFocus();
  await expect.element(document).toHaveAttribute("aria-selected", "false");

  await document.click();

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect.element(document).toHaveAttribute("aria-selected", "true");
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
});

test("folder files can be renamed, cancelled, and opened in a file window", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  const folder = page.getByRole("listbox", { name: "Photos contents" });
  const beach = folder.getByRole("option", { name: /Beach.jpg/ });

  await beach.click();

  await userEvent.keyboard("{Enter}");

  const input = page.getByRole("textbox", { name: "Rename Beach.jpg" });
  await expect.element(input).toHaveFocus();

  await userEvent.keyboard("Trip.jpg{Escape}");

  await expect.element(beach).toBeVisible();

  await beach.click();

  await userEvent.keyboard("{F2}");

  await userEvent.keyboard("Holiday.jpg{Enter}");

  const renamed = folder.getByRole("option", { name: /Holiday.jpg/ });
  await expect.element(renamed).toBeVisible();

  await renamed.dblClick();

  await expect
    .element(page.getByText("This window belongs to Holiday.jpg."))
    .toBeVisible();
});

test("an agent can discover and open folders through the list API", async () => {
  const agent = createAgent();

  await render(<App />);

  const desktop = agent
    .snapshot()
    .find((entry) => entry.label === "Files" && !entry.offPage);
  expect(desktop).toBeDefined();
  const folder = desktop?.items?.find((item) =>
    item.label?.startsWith("Photos"),
  );
  expect(folder).toBeDefined();

  const result = await agent.act({
    steps: [
      {
        ref: desktop?.ref ?? "Files",
        action: "activate",
        args: [folder?.value],
      },
    ],
  });

  expect(result.ok, result.error?.message).toBe(true);
  await expect
    .element(page.getByRole("listbox", { name: "Photos contents" }))
    .toBeVisible();
});

test("context-menu Rename edits the selected folder row", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  await page
    .getByRole("option", { name: /Beach.jpg/ })
    .click({ button: "right" });

  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();

  await expect
    .element(page.getByRole("textbox", { name: "Rename Beach.jpg" }))
    .toHaveFocus();

  await userEvent.keyboard("Menu.jpg{Enter}");

  await expect
    .element(page.getByRole("option", { name: /Menu.jpg/ }))
    .toBeVisible();
});

test.each(["desktop", "folder"])(
  "%s menu disables multi-rename and opens both selected items",
  async (layout) => {
    await render(<App />);

    if (layout === "folder")
      await page.getByRole("option", { name: /Photos/ }).dblClick();

    const list = page.getByRole("listbox", {
      name: layout === "desktop" ? "Files" : "Photos contents",
      exact: true,
    });
    const firstName = layout === "desktop" ? "Document" : "Beach.jpg";
    const secondName = layout === "desktop" ? "Photos" : "Mountains.jpg";
    const first = list.getByRole("option", { name: new RegExp(firstName) });
    const second = list.getByRole("option", { name: new RegExp(secondName) });

    await first.click();

    await second.click({ modifiers: ["ControlOrMeta"] });

    await first.click({ button: "right" });

    await expect
      .element(page.getByRole("menuitem", { name: "Rename", exact: true }))
      .toHaveAttribute("aria-disabled", "true");

    await userEvent.keyboard("{Home}{ArrowDown}{Enter}");

    await expect
      .element(page.getByRole("menu", { name: "File actions" }))
      .toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();

    await page.getByRole("menuitem", { name: "Open (2)", exact: true }).click();

    await expect
      .element(page.getByRole("region", { name: firstName, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("region", { name: secondName, exact: true }))
      .toBeVisible();
  },
);

test("closing a child restores folder shortcuts before returning to the desktop", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  await page.getByRole("option", { name: /Beach.jpg/ }).dblClick();

  await page
    .getByRole("button", { name: "Close Beach.jpg", exact: true })
    .click();

  await page.getByRole("heading", { name: "Desktop", exact: true }).click();

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect
    .element(page.getByRole("option", { name: /Mountains.jpg/ }))
    .toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Close Photos", exact: true }).click();

  await page.getByRole("heading", { name: "Desktop", exact: true }).click();

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect
    .element(page.getByRole("option", { name: /Document/ }))
    .toHaveAttribute("aria-selected", "true");
});

test("a folder row opens a nested folder and its files in separate windows", async () => {
  await render(<App />);

  const desktop = page.getByRole("listbox", { name: "Files", exact: true });

  await desktop.getByRole("option", { name: /Photos/ }).dblClick();

  const photos = page.getByRole("listbox", { name: "Photos contents" });
  const trips = photos.getByRole("option", { name: /Trips/ });
  await expect.element(trips).toBeVisible();
  await expect
    .element(desktop.getByRole("option", { name: /Trips/ }))
    .not.toBeInTheDocument();

  await trips.dblClick();

  const contents = page.getByRole("listbox", { name: "Trips contents" });
  const itinerary = contents.getByRole("option", { name: /Itinerary.txt/ });
  await expect.element(itinerary).toBeVisible();
  await expect
    .element(contents.getByRole("option", { name: /Beach.jpg/ }))
    .not.toBeInTheDocument();

  await itinerary.dblClick();

  await expect
    .element(page.getByText("This window belongs to Itinerary.txt."))
    .toBeVisible();
  await expect.element(photos).toBeVisible();
  await expect.element(contents).toBeVisible();
});

test("folder headers show enabled view controls with List selected initially", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  const folder = page.getByRole("region", { name: "Photos", exact: true });
  const views = folder.getByRole("radiogroup", { name: "Photos view layout" });
  const list = views.getByRole("radio", { name: "List view", exact: true });
  const grid = views.getByRole("radio", { name: "Grid view", exact: true });
  await expect.element(list).toBeChecked();
  await expect.element(grid).not.toBeDisabled();

  await list.click();

  await userEvent.keyboard("{ArrowLeft}{ArrowRight} ");

  await expect.element(list).toBeChecked();

  await page.getByRole("option", { name: /Document/ }).dblClick();

  await expect
    .element(
      page
        .getByRole("region", { name: "Document", exact: true })
        .getByRole("radiogroup"),
    )
    .not.toBeInTheDocument();
});

test("switching folder views preserves selection and follows the grid with arrow keys", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  const window = page.getByRole("region", { name: "Photos", exact: true });
  const contents = window.getByRole("listbox", { name: "Photos contents" });
  const beach = contents.getByRole("option", { name: /Beach.jpg/ });

  await beach.click();

  const mountains = contents.getByRole("option", { name: /Mountains.jpg/ });

  await mountains.click({ modifiers: ["ControlOrMeta"] });

  const trips = contents.getByRole("option", { name: /Trips/ });

  await window.getByRole("radio", { name: "Grid view", exact: true }).click();

  await expect.element(beach).toHaveAttribute("aria-selected", "true");
  await expect.element(mountains).toHaveAttribute("aria-selected", "true");
  expect(beach.element().getBoundingClientRect().top).toBe(
    mountains.element().getBoundingClientRect().top,
  );
  expect(mountains.element().getBoundingClientRect().left).toBeGreaterThan(
    beach.element().getBoundingClientRect().left,
  );

  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");

  await expect.element(trips).toHaveAttribute("aria-selected", "true");

  await beach.click();

  await userEvent.keyboard("{ArrowRight}");

  await expect.element(mountains).toHaveFocus();

  await userEvent.keyboard("{End}");

  await expect.element(trips).toHaveFocus();

  await window.getByRole("radio", { name: "List view", exact: true }).click();

  expect(mountains.element().getBoundingClientRect().top).toBe(
    beach.element().getBoundingClientRect().bottom,
  );
  await expect.element(beach).toHaveAttribute("aria-selected", "true");
});

test("each window owns its view and closing it resets the view to List", async () => {
  await render(<App />);

  const photosIcon = page.getByRole("option", { name: /Photos/ });

  await photosIcon.dblClick();

  const photos = page.getByRole("region", { name: "Photos", exact: true });

  await photos.getByRole("radio", { name: "Grid view", exact: true }).click();

  await photos.getByRole("option", { name: /Trips/ }).dblClick();

  const trips = page.getByRole("region", { name: "Trips", exact: true });
  await expect
    .element(trips.getByRole("radio", { name: "List view", exact: true }))
    .toBeChecked();

  await page.getByRole("button", { name: "Close Trips", exact: true }).click();

  await page.getByRole("button", { name: "Close Photos", exact: true }).click();

  await photosIcon.dblClick();

  await expect
    .element(photos.getByRole("radio", { name: "List view", exact: true }))
    .toBeChecked();
});

test("dragging a grid item leaves it in place", async () => {
  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  await page.getByRole("radio", { name: "Grid view", exact: true }).click();

  const beach = page.getByRole("option", { name: /Beach.jpg/ });
  const beforeDrag = beach.element().getBoundingClientRect();
  const desktopRect = page
    .getByRole("listbox", { name: "Files", exact: true })
    .element()
    .getBoundingClientRect();
  const from = {
    x: beforeDrag.left - desktopRect.left + 8,
    y: beforeDrag.top - desktopRect.top + 8,
  };

  await commands.dragPointer(from, { x: from.x + 60, y: from.y + 60 });

  const afterDrag = beach.element().getBoundingClientRect();
  expect(afterDrag.left).toBe(beforeDrag.left);
  expect(afterDrag.top).toBe(beforeDrag.top);
});

test("an agent can switch a folder to Grid view", async () => {
  const agent = createAgent();

  await render(<App />);

  await page.getByRole("option", { name: /Photos/ }).dblClick();

  const result = await agent.act({
    steps: [{ ref: "Photos view layout", action: "setValue", args: ["grid"] }],
  });

  expect(result.ok, result.error?.message).toBe(true);
  await expect
    .element(page.getByRole("radio", { name: "Grid view", exact: true }))
    .toBeChecked();
});
