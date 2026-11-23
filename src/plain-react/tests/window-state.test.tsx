const Button = "button";

import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { FileEntry } from "../models/file-entry";
import { useWindows } from "../hooks/use-windows";

const items: FileEntry[] = [
  { id: "document", name: "Document", kind: "file", parentId: null },
  { id: "photos", name: "Photos", kind: "directory", parentId: null },
];

function WindowControls() {
  const { windows, activeWindowId, openWindow, openWindows, closeWindow } =
    useWindows(items);

  return (
    <>
      <Button onClick={() => openWindows(["document", "photos"])}>
        Open both
      </Button>
      <Button
        onClick={() => {
          closeWindow("document");
          closeWindow("photos");
        }}
      >
        Close both
      </Button>
      <Button onClick={() => openWindow("missing")}>Open missing item</Button>
      <output aria-label="Open windows">
        {windows.map(({ id }) => id).join(",") || "none"}
      </output>
      <output aria-label="Active window">{activeWindowId ?? "desktop"}</output>
    </>
  );
}

test("batched closes remove every window and return activation to the desktop", async () => {
  await render(<WindowControls />);

  await page.getByRole("button", { name: "Open both" }).click();

  await expect
    .element(page.getByLabelText("Open windows"))
    .toHaveTextContent("document,photos");
  await expect
    .element(page.getByLabelText("Active window"))
    .toHaveTextContent("photos");

  await page.getByRole("button", { name: "Close both" }).click();

  await expect
    .element(page.getByLabelText("Open windows"))
    .toHaveTextContent("none");
  await expect
    .element(page.getByLabelText("Active window"))
    .toHaveTextContent("desktop");
});

test("opening a missing item preserves existing windows and activation", async () => {
  await render(<WindowControls />);

  await page.getByRole("button", { name: "Open both" }).click();

  await page.getByRole("button", { name: "Open missing item" }).click();

  await expect
    .element(page.getByLabelText("Open windows"))
    .toHaveTextContent("document,photos");
  await expect
    .element(page.getByLabelText("Active window"))
    .toHaveTextContent("photos");
});
