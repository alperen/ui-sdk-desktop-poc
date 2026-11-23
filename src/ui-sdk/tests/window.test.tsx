import { createAgent } from "@ui-sdk/react/agent";
import { beforeEach, expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { App } from "../app";
import "../styles.css";

const agent = createAgent();

const windowPanel = page.getByRole("region", { name: "Document" });
const handle = page.getByRole("button", { name: /Move Document/ });
const desktop = page.getByRole("listbox", { name: "Files" });

beforeEach(async () => {
  await render(<App />);
  await page.getByRole("option", { name: /Document/ }).dblClick();
});

function position() {
  const rect = windowPanel.element().getBoundingClientRect();
  const workspace = desktop.element().getBoundingClientRect();

  return { x: rect.left - workspace.left, y: rect.top - workspace.top };
}

function handlePoint() {
  const rect = handle.element().getBoundingClientRect();
  const workspace = desktop.element().getBoundingClientRect();

  return {
    x: rect.left - workspace.left + 30,
    y: rect.top - workspace.top + 16,
  };
}

test("dragging the title bar moves the window", async () => {
  const before = position();
  const from = handlePoint();
  await commands.dragPointer(from, { x: from.x + 80, y: from.y + 40 });

  expect(position()).toEqual({ x: before.x + 80, y: before.y + 40 });
});

test("Escape cancels a window drag", async () => {
  const before = position();
  const from = handlePoint();
  await commands.dragPointer(from, { x: from.x + 80, y: from.y + 40 }, true);

  expect(position()).toEqual(before);
});

test("Alt and an arrow move the focused title bar", async () => {
  const before = position();
  await handle.click();
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");

  expect(position()).toEqual({ x: before.x + 4, y: before.y });
});

test("dragging content leaves the window in place", async () => {
  const before = position();
  const from = handlePoint();
  from.y += 55;
  await commands.dragPointer(from, { x: from.x + 80, y: from.y + 40 });

  expect(position()).toEqual(before);
});

test("a dropped window stays inside the workspace", async () => {
  const from = handlePoint();
  await commands.dragPointer(from, { x: -100, y: -100 });

  expect(position()).toEqual({ x: 0, y: 0 });
});

test("an agent can find and move the window", async () => {
  const entry = agent
    .snapshot()
    .find((entry) => entry.component === "window" && !entry.offPage);
  expect(entry?.label).toBe("Document");
  expect(entry?.actions).toContain("moveTo");

  const result = await agent.act({
    steps: [{ ref: "Document", action: "moveTo", args: [{ x: 120, y: 200 }] }],
  });

  expect(result.ok).toBe(true);
  expect(position()).toEqual({ x: 120, y: 200 });
});

test("opening a second file keeps both windows open", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();

  await expect.element(windowPanel).toBeVisible();
  await expect
    .element(page.getByRole("region", { name: "notes.txt", exact: true }))
    .toBeVisible();
});

test("opening a file again does not duplicate its window", async () => {
  await page.getByRole("option", { name: /Document/ }).dblClick();

  expect(
    page.getByRole("region", { name: "Document", exact: true }).elements(),
  ).toHaveLength(1);
});

test("closing one window leaves the other window open", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();
  await page
    .getByRole("button", { name: "Close notes.txt", exact: true })
    .click();

  await expect
    .element(page.getByRole("region", { name: "notes.txt", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(windowPanel).toBeVisible();
});

test("a closed file window can be reopened", async () => {
  await page
    .getByRole("button", { name: "Close Document", exact: true })
    .click();
  await expect.element(windowPanel).not.toBeInTheDocument();

  await page.getByRole("option", { name: /Document/ }).dblClick();

  await expect.element(windowPanel).toBeVisible();
});

test("opening an existing window flashes its border without resetting its position", async () => {
  await handle.click();
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");

  const before = position();
  const element = windowPanel.element();
  const border = getComputedStyle(element).borderColor;

  await page.getByRole("option", { name: /Document/ }).dblClick();

  const animations = element.getAnimations();
  expect(animations).toHaveLength(1);
  expect(position()).toEqual(before);

  const [animation] = animations;
  animation.pause();
  animation.currentTime = 350;
  expect(getComputedStyle(element).borderColor).not.toBe(border);

  animation.finish();
  await animation.finished;
  expect(getComputedStyle(element).borderColor).toBe(border);
  expect(element.getAnimations()).toHaveLength(0);
});

test("reopening again restarts the border flash", async () => {
  const documentItem = page.getByRole("option", { name: /Document/ });
  await documentItem.dblClick();
  const first = windowPanel.element().getAnimations()[0];
  first.pause();

  await documentItem.dblClick();

  const animations = windowPanel.element().getAnimations();
  expect(animations).toHaveLength(1);
  expect(animations[0]).not.toBe(first);
  expect(first.playState).toBe("idle");
});

test("clicking a background window brings it forward without moving it", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();
  const notesWindow = page.getByRole("region", {
    name: "notes.txt",
    exact: true,
  });
  const before = position();

  await windowPanel.click({ position: { x: 10, y: 10 } });

  await expect.element(windowPanel).toHaveAttribute("data-active");
  await expect.element(notesWindow).not.toHaveAttribute("data-active");
  expect(
    Number(getComputedStyle(windowPanel.element()).zIndex),
  ).toBeGreaterThan(Number(getComputedStyle(notesWindow.element()).zIndex));
  expect(position()).toEqual(before);
});

test("reopening a background file brings its window forward", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();

  await page.getByRole("option", { name: /Document/ }).dblClick();

  await expect.element(windowPanel).toHaveAttribute("data-active");
  expect(
    page.getByRole("region", { name: "Document", exact: true }).elements(),
  ).toHaveLength(1);
});

test("keyboard focus activates a background window without stealing control focus", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();
  page
    .getByRole("button", { name: "Close Document", exact: true })
    .element()
    .focus();

  await expect.element(windowPanel).toHaveAttribute("data-active");
  await expect
    .element(page.getByRole("button", { name: "Close Document", exact: true }))
    .toHaveFocus();
});

test("closing the active window activates the remaining window", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();

  await page
    .getByRole("button", { name: "Close notes.txt", exact: true })
    .click();

  await expect.element(windowPanel).toHaveAttribute("data-active");
});

test("clicking background window content brings it forward", async () => {
  await page.getByRole("option", { name: /notes.txt/ }).dblClick();

  await windowPanel.click({ position: { x: 12, y: 70 } });

  await expect.element(windowPanel).toHaveAttribute("data-active");
});

const resizeCorners = [
  { name: "top left", dx: -40, dy: -40, x: -40, y: -40 },
  { name: "top right", dx: 40, dy: -40, x: 0, y: -40 },
  { name: "bottom left", dx: -40, dy: 40, x: -40, y: 0 },
  { name: "bottom right", dx: 40, dy: 40, x: 0, y: 0 },
];

test.each(resizeCorners)(
  "resizing from $name preserves the opposite corner",
  async ({ name, dx, dy, x, y }) => {
    const before = windowPanel.element().getBoundingClientRect();
    const corner = page.getByRole("button", {
      name: `Resize Document ${name}. Use arrow keys.`,
      exact: true,
    });
    const rect = corner.element().getBoundingClientRect();
    const workspace = desktop.element().getBoundingClientRect();
    const from = {
      x: rect.left - workspace.left + rect.width / 2,
      y: rect.top - workspace.top + rect.height / 2,
    };

    await commands.dragPointer(from, { x: from.x + dx, y: from.y + dy });

    const after = windowPanel.element().getBoundingClientRect();
    expect(after.left).toBe(before.left + x);
    expect(after.top).toBe(before.top + y);
    expect(after.width).toBe(before.width + 40);
    expect(after.height).toBe(before.height + 40);
  },
);

test("corner arrows resize with the keyboard", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  await page
    .getByRole("button", {
      name: "Resize Document bottom right. Use arrow keys.",
      exact: true,
    })
    .click();

  await userEvent.keyboard("{ArrowRight}{ArrowDown}");

  const after = windowPanel.element().getBoundingClientRect();
  expect(after.width).toBe(before.width + 4);
  expect(after.height).toBe(before.height + 4);
});

test("Escape cancels a resize and restores the full window geometry", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  const workspace = desktop.element().getBoundingClientRect();
  const from = {
    x: before.right - workspace.left - 8,
    y: before.bottom - workspace.top - 8,
  };

  await commands.dragPointer(from, { x: from.x + 80, y: from.y + 80 }, true);

  const after = windowPanel.element().getBoundingClientRect();
  expect(after.toJSON()).toEqual(before.toJSON());
});

test("resizing keeps minimum dimensions", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  const workspace = desktop.element().getBoundingClientRect();
  const from = {
    x: before.right - workspace.left - 8,
    y: before.bottom - workspace.top - 8,
  };

  await commands.dragPointer(from, {
    x: from.x - before.width,
    y: from.y - before.height,
  });

  const after = windowPanel.element().getBoundingClientRect();
  expect(after.width).toBe(240);
  expect(after.height).toBe(120);
});

test("resizing stays inside the workspace", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  const workspace = desktop.element().getBoundingClientRect();
  const from = {
    x: before.right - workspace.left - 8,
    y: before.bottom - workspace.top - 8,
  };

  await commands.dragPointer(from, { x: 1100, y: 900 });

  const after = windowPanel.element().getBoundingClientRect();
  expect(after.right).toBeLessThanOrEqual(workspace.right);
  expect(after.bottom).toBeLessThanOrEqual(workspace.bottom);
});

test("maximize fills the workspace and keeps the button focused", async () => {
  await page
    .getByRole("button", { name: "Maximize Document", exact: true })
    .click();

  const workspace = desktop.element().getBoundingClientRect();
  const window = windowPanel.element().getBoundingClientRect();
  expect(window.toJSON()).toEqual(workspace.toJSON());
  await expect
    .element(
      page.getByRole("button", { name: "Restore Document", exact: true }),
    )
    .toHaveFocus();
});

test("restore returns to the moved and resized window geometry", async () => {
  await handle.click();
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
  await page
    .getByRole("button", {
      name: "Resize Document bottom right. Use arrow keys.",
      exact: true,
    })
    .click();
  await userEvent.keyboard("{ArrowRight}{ArrowDown}");
  const before = windowPanel.element().getBoundingClientRect();

  await page
    .getByRole("button", { name: "Maximize Document", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore Document", exact: true })
    .click();

  expect(windowPanel.element().getBoundingClientRect().toJSON()).toEqual(
    before.toJSON(),
  );
});

test("a maximized window cannot be dragged or resized", async () => {
  await page
    .getByRole("button", { name: "Maximize Document", exact: true })
    .click();
  const before = windowPanel.element().getBoundingClientRect();
  const from = handlePoint();

  await commands.dragPointer(from, { x: from.x + 80, y: from.y + 80 });
  await handle.click();
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");

  expect(windowPanel.element().getBoundingClientRect().toJSON()).toEqual(
    before.toJSON(),
  );
  expect(
    page.getByRole("button", { name: /Resize Document/ }).elements(),
  ).toHaveLength(0);
});

test("maximize and restore work with the keyboard", async () => {
  page
    .getByRole("button", { name: "Maximize Document", exact: true })
    .element()
    .focus();

  await userEvent.keyboard("{Enter}");
  await expect.element(windowPanel).toHaveAttribute("data-maximized");
  await userEvent.keyboard(" ");

  await expect.element(windowPanel).not.toHaveAttribute("data-maximized");
});

test("double-clicking the title bar maximizes the window", async () => {
  await handle.dblClick();

  await expect.element(windowPanel).toHaveAttribute("data-maximized");
});

test("double-clicking a maximized title bar restores its geometry", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  await page
    .getByRole("button", { name: "Maximize Document", exact: true })
    .click();

  await handle.dblClick();

  await expect.element(windowPanel).not.toHaveAttribute("data-maximized");
  expect(windowPanel.element().getBoundingClientRect().toJSON()).toEqual(
    before.toJSON(),
  );
});

const resizeEdges = [
  { name: "top", dx: 0, dy: -40, x: 0, y: -40, width: 0, height: 40 },
  { name: "right", dx: 40, dy: 0, x: 0, y: 0, width: 40, height: 0 },
  { name: "bottom", dx: 0, dy: 40, x: 0, y: 0, width: 0, height: 40 },
  { name: "left", dx: -40, dy: 0, x: -40, y: 0, width: 40, height: 0 },
];

test.each(resizeEdges)(
  "resizing the $name edge changes only its axis",
  async ({ name, dx, dy, x, y, width, height }) => {
    const before = windowPanel.element().getBoundingClientRect();
    const edge = page.getByRole("button", {
      name: `Resize Document ${name}. Use arrow keys.`,
      exact: true,
    });
    const rect = edge.element().getBoundingClientRect();
    const workspace = desktop.element().getBoundingClientRect();
    const from = {
      x: rect.left - workspace.left + rect.width / 2,
      y: rect.top - workspace.top + rect.height / 2,
    };

    await commands.dragPointer(from, { x: from.x + dx, y: from.y + dy });

    const after = windowPanel.element().getBoundingClientRect();
    expect(after.left).toBe(before.left + x);
    expect(after.top).toBe(before.top + y);
    expect(after.width).toBe(before.width + width);
    expect(after.height).toBe(before.height + height);
  },
);

test("edge keyboard resizing ignores the perpendicular axis", async () => {
  const before = windowPanel.element().getBoundingClientRect();
  await page
    .getByRole("button", {
      name: "Resize Document right. Use arrow keys.",
      exact: true,
    })
    .click();

  await userEvent.keyboard("{ArrowRight}{ArrowDown}");

  const after = windowPanel.element().getBoundingClientRect();
  expect(after.width).toBe(before.width + 4);
  expect(after.height).toBe(before.height);
});

test("larger windows open within a smaller workspace", async () => {
  await page
    .getByRole("button", { name: "Close Document", exact: true })
    .click();
  const workspace = desktop.element().parentElement;
  if (!workspace) throw new Error("Missing workspace");

  workspace.style.width = "640px";
  workspace.style.height = "420px";
  workspace.style.flex = "none";
  await page.getByRole("option", { name: /Document/ }).dblClick();

  const bounds = workspace.getBoundingClientRect();
  const rect = windowPanel.element().getBoundingClientRect();
  expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
  expect(rect.top).toBeGreaterThanOrEqual(bounds.top);
  expect(rect.right).toBeLessThanOrEqual(bounds.right);
  expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
});
