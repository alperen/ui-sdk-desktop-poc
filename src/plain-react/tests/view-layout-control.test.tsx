import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ViewLayoutControl } from "../components/window/view-layout-control";

test("reports layout changes and follows the layout supplied by its parent", async () => {
  const onChange = vi.fn();
  const control = await render(
    <ViewLayoutControl label="Folder view" layout="list" onChange={onChange} />,
  );

  const grid = page.getByRole("radio", { name: "Grid view" });
  const list = page.getByRole("radio", { name: "List view" });
  await expect.element(list).toBeChecked();

  await grid.click();

  expect(onChange).toHaveBeenCalledWith("grid");

  await control.rerender(
    <ViewLayoutControl label="Folder view" layout="grid" onChange={onChange} />,
  );

  await expect.element(grid).toBeChecked();

  await control.rerender(
    <ViewLayoutControl label="Folder view" layout="list" onChange={onChange} />,
  );

  await expect.element(list).toBeChecked();
  await expect.element(grid).not.toBeChecked();
});
