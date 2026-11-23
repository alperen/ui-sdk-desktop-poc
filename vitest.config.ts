import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import viteConfig from "./vite.config";

type Point = { x: number; y: number };

const dragPointer: BrowserCommand<
  [from: Point, to: Point, cancel?: boolean, hold?: boolean]
> = async ({ page, iframe }, from, to, cancel = false, hold = false) => {
  const desktop = await iframe
    .getByRole("listbox", { name: "Files" })
    .boundingBox();
  if (!desktop) throw new Error("Desktop is not visible");

  await page.mouse.move(desktop.x + from.x, desktop.y + from.y);
  await page.mouse.down();

  try {
    await page.mouse.move(desktop.x + to.x, desktop.y + to.y, { steps: 12 });
    if (cancel) await page.keyboard.press("Escape");
  } finally {
    if (!hold) await page.mouse.up();
  }
};

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/{ui-sdk,plain-react}/tests/**/*.test.tsx"],
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        viewport: { width: 1000, height: 700 },
        commands: {
          dragPointer,
          releasePointer: async ({ page }) => page.mouse.up(),
          movePointer: async ({ page, iframe }, point: Point) => {
            const desktop = await iframe
              .getByRole("listbox", { name: "Files", exact: true })
              .boundingBox();
            if (!desktop) throw new Error("Desktop is not visible");
            await page.mouse.move(desktop.x + point.x, desktop.y + point.y);
          },
        },
      },
    },
  }),
);
