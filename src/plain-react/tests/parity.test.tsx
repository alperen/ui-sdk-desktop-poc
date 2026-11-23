import { beforeEach, expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "../app";
import "../styles.css";

beforeEach(async () => {
  await render(<App />);
});

test("typeahead includes spaces in multiword names", async () => {
  for (const [oldName, name] of [
    ["Document", "My alpha"],
    ["Photos", "My beta"],
  ]) {
    await page.getByRole("option", { name: new RegExp(oldName) }).click();
    await userEvent.keyboard(`{F2}${name}{Enter}`);
  }
  await page.getByRole("option", { name: /notes.txt/ }).click();
  await userEvent.keyboard("My a");
  await expect
    .element(page.getByRole("option", { name: /My alpha/ }))
    .toHaveFocus();
});

test("pointer opening a folder focuses its first row without a keyboard focus ring", async () => {
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  const beach = page.getByRole("option", { name: /Beach.jpg/ });
  await expect.element(beach).toHaveFocus();
  expect(beach.element().matches(":focus-visible")).toBe(false);
  await userEvent.keyboard("{ArrowDown}");
  const mountains = page.getByRole("option", { name: /Mountains.jpg/ });
  await expect.element(mountains).toHaveFocus();
  expect(mountains.element().matches(":focus-visible")).toBe(true);
});

test("sibling duplicate rejection preserves open identity while another parent may reuse the name", async () => {
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
  try {
    await page.getByRole("option", { name: /Photos/ }).dblClick();
    const beach = page.getByRole("option", { name: /Beach.jpg/ });
    await beach.click();
    await userEvent.keyboard("{F2}Mountains.jpg{Enter}");
    expect(alert).toHaveBeenCalledOnce();
    await expect.element(beach).toBeVisible();
    await beach.dblClick();
    await page
      .getByRole("button", { name: "Close Beach.jpg", exact: true })
      .click();
    await beach.click();
    await userEvent.keyboard("{F2}Document{Enter}");
    expect(alert).toHaveBeenCalledOnce();
    const folder = page.getByRole("region", { name: "Photos", exact: true });
    const renamed = folder.getByRole("option", { name: /Document/ });
    await renamed.dblClick();
    await expect
      .element(page.getByText("This window belongs to Document."))
      .toBeVisible();
    await page
      .getByRole("button", { name: "Close Document", exact: true })
      .click();
    await page.getByRole("option", { name: /Photos/ }).click();
    await userEvent.keyboard("{F2}Pictures{Enter}");
    await expect
      .element(page.getByRole("region", { name: "Pictures", exact: true }))
      .toBeVisible();
    await page.getByRole("option", { name: /Pictures/ }).dblClick();
    expect(
      page.getByRole("region", { name: "Pictures", exact: true }).elements(),
    ).toHaveLength(1);
    await expect
      .element(
        page
          .getByRole("region", { name: "Pictures", exact: true })
          .getByRole("option", { name: /Document/ }),
      )
      .toBeVisible();
  } finally {
    alert.mockRestore();
  }
});

test("held lasso previews a different selection and Escape restores the original", async () => {
  const original = page.getByRole("option", { name: /notes.txt/ });
  const document = page.getByRole("option", { name: /Document/ });
  await original.click();
  await commands.dragPointer({ x: 5, y: 5 }, { x: 320, y: 70 }, false, true);
  try {
    expect(getComputedStyle(document.element()).backgroundColor).toBe(
      "rgb(220, 232, 255)",
    );
    await expect.element(document).toHaveAttribute("aria-selected", "false");
    await expect.element(original).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
  } finally {
    await commands.releasePointer();
  }
  await expect.element(original).toHaveAttribute("aria-selected", "true");
  await expect.element(document).toHaveAttribute("aria-selected", "false");
});

test("repeating a typeahead character cycles matching items", async () => {
  for (const [oldName, name] of [
    ["Document", "Alpha"],
    ["Photos", "Apple"],
  ]) {
    await page.getByRole("option", { name: new RegExp(oldName) }).click();
    await userEvent.keyboard(`{F2}${name}{Enter}`);
  }
  await page.getByRole("option", { name: /notes.txt/ }).click();
  await userEvent.keyboard("aa");
  await expect
    .element(page.getByRole("option", { name: /Apple/ }))
    .toHaveFocus();
});

test.each(["lasso", "item"])(
  "cancelled %s released outside does not consume the next item click",
  async (kind) => {
    const document = page.getByRole("option", { name: /Document/ });
    const photos = page.getByRole("option", { name: /Photos/ });
    await document.click();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await commands.dragPointer(
      kind === "lasso" ? { x: 5, y: 5 } : { x: 30, y: 30 },
      { x: 320, y: 70 },
      false,
      true,
    );
    try {
      await userEvent.keyboard("{Escape}");
      await commands.movePointer({ x: 100, y: -40 });
    } finally {
      await commands.releasePointer();
    }
    await document.click();
    await expect.element(document).toHaveAttribute("aria-selected", "true");
    await expect.element(photos).toHaveAttribute("aria-selected", "false");
  },
);

test.each(["Shift", "Control", "Meta"])(
  "holding %s during a selected group drag preserves spacing and selection",
  async (modifier) => {
    const document = page.getByRole("option", { name: /Document/ });
    const photos = page.getByRole("option", { name: /Photos/ });
    await document.click();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await userEvent.keyboard(`{${modifier}>}`);
    try {
      await commands.dragPointer({ x: 30, y: 30 }, { x: 150, y: 110 });
    } finally {
      await userEvent.keyboard(`{/${modifier}}`);
    }
    const desktop = page
      .getByRole("listbox", { name: "Files", exact: true })
      .element()
      .getBoundingClientRect();
    expect(document.element().getBoundingClientRect().left - desktop.left).toBe(
      140,
    );
    expect(photos.element().getBoundingClientRect().left - desktop.left).toBe(
      300,
    );
    await expect.element(document).toHaveAttribute("aria-selected", "true");
    await expect.element(photos).toHaveAttribute("aria-selected", "true");
  },
);

test("context menu initially focuses its surface and supports typeahead", async () => {
  await page
    .getByRole("option", { name: /Document/ })
    .click({ button: "right" });
  await expect
    .element(page.getByRole("menu", { name: "File actions" }))
    .toHaveFocus();
  await userEvent.keyboard("r");
  await expect
    .element(page.getByRole("menuitem", { name: "Rename", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("textbox", { name: "Rename Document" }))
    .toHaveFocus();
});

test("typeahead matches accented names without requiring the accent", async () => {
  for (const [oldName, name] of [
    ["Document", "École"],
    ["Photos", "Epsilon"],
  ]) {
    await page.getByRole("option", { name: new RegExp(oldName) }).click();
    await userEvent.keyboard(`{F2}${name}{Enter}`);
  }
  await page.getByRole("option", { name: /notes.txt/ }).click();
  await userEvent.keyboard("e");
  await expect
    .element(page.getByRole("option", { name: /École/ }))
    .toHaveFocus();
});

test("a real repeated-letter prefix wins over cycling single-letter matches", async () => {
  for (const [oldName, name] of [
    ["Document", "Llama"],
    ["Photos", "Lemon"],
  ]) {
    await page.getByRole("option", { name: new RegExp(oldName) }).click();
    await userEvent.keyboard(`{F2}${name}{Enter}`);
  }
  await page.getByRole("option", { name: /notes.txt/ }).click();
  await userEvent.keyboard("ll");
  await expect
    .element(page.getByRole("option", { name: /Llama/ }))
    .toHaveFocus();
});

test("reverse Tab into a newly mounted column enters its first item", async () => {
  await page.getByRole("option", { name: /Photos/ }).dblClick();
  await page.getByRole("radio", { name: "Columns view" }).click();
  await page.getByRole("option", { name: /Trips/ }).click();
  const child = page.getByRole("listbox", { name: "Trips contents" });
  expect(child.element().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Resize Photos top left. Use arrow keys.",
      exact: true,
    })
    .click();
  await userEvent.tab({ shift: true });
  await expect
    .element(child.getByRole("option", { name: /Itinerary.txt/ }))
    .toHaveFocus();
});
