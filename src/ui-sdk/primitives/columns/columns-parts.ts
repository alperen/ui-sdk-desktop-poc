import { createParts } from "@ui-sdk/react/primitive";
import { columns } from "./columns";

export const { Root: ColumnsRoot, Column: ColumnsColumn } = createParts(
  columns,
  {
    root: "div",
    column: "div",
  },
);
