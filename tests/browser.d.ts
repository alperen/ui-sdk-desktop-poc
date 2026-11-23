import "vitest/browser";

type Point = { x: number; y: number };

declare module "vitest/browser" {
  interface BrowserCommands {
    dragPointer: (
      from: Point,
      to: Point,
      cancel?: boolean,
      hold?: boolean,
    ) => Promise<void>;
    releasePointer: () => Promise<void>;
    movePointer: (point: Point) => Promise<void>;
  }
}
