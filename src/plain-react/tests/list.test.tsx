import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  FileList,
  FileListItem,
  FileListLasso,
} from "../primitives/list/file-list-parts";
import "../styles.css";

test("fixed rows ignore positions and dragging while retaining keyboard and lasso selection", async () => {
  await render(
    <FileList
      aria-label="Files"
      layout="vertical"
      active={true}
      defaultPositions={{ a: { x: 90, y: 90 } }}
      style={{ position: "relative", height: 300, padding: 10 }}
    >
      {["a", "b", "c"].map((id) => (
        <FileListItem key={id} value={id} label={id} style={{ height: 36 }}>
          {id}
        </FileListItem>
      ))}
      <FileListLasso />
    </FileList>,
  );

  const first = page.getByRole("option", { name: "a", exact: true });
  const second = page.getByRole("option", { name: "b", exact: true });
  const third = page.getByRole("option", { name: "c", exact: true });
  const before = first.element().getBoundingClientRect();

  await commands.dragPointer({ x: 30, y: 20 }, { x: 120, y: 130 });

  const after = first.element().getBoundingClientRect();
  expect(after.left).toBe(before.left);
  expect(after.top).toBe(before.top);

  await first.click();

  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");

  await expect.element(second).toHaveFocus();
  await expect.element(first).toHaveAttribute("aria-selected", "true");
  await expect.element(second).toHaveAttribute("aria-selected", "true");
  await expect.element(third).toHaveAttribute("aria-selected", "false");

  await userEvent.keyboard("{End}");

  await expect.element(third).toHaveFocus();

  await userEvent.keyboard("{Home}");

  await expect.element(first).toHaveFocus();

  await commands.dragPointer({ x: 2, y: 2 }, { x: 100, y: 70 });

  await expect.element(first).toHaveAttribute("aria-selected", "true");
  await expect.element(second).toHaveAttribute("aria-selected", "true");
  await expect.element(third).toHaveAttribute("aria-selected", "false");

  await third.click();

  await first.click({ modifiers: ["Shift"] });

  await expect.element(second).toHaveAttribute("aria-selected", "true");

  await second.click({ modifiers: ["ControlOrMeta"] });

  await expect.element(second).toHaveAttribute("aria-selected", "false");

  await commands.dragPointer({ x: 2, y: 2 }, { x: 100, y: 70 }, true);

  await expect.element(first).toHaveAttribute("aria-selected", "true");
  await expect.element(second).toHaveAttribute("aria-selected", "false");
  await expect.element(third).toHaveAttribute("aria-selected", "true");
});
