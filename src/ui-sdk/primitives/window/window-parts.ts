import { createParts } from "@ui-sdk/react/primitive";
import { windowPrimitive } from "./window";

const {
  Root: WindowRoot,
  Handle: WindowHandle,
  Content: WindowContent,
  ResizeHandle: WindowResizeHandle,
  Maximize: WindowMaximize,
} = createParts(windowPrimitive, {
  root: "section",
  handle: "button",
  content: "div",
  "resize-handle": "button",
  maximize: "button",
});

export {
  WindowContent,
  WindowHandle,
  WindowMaximize,
  WindowResizeHandle,
  WindowRoot,
};
