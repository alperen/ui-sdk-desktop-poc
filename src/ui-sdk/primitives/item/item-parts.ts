import { createParts } from "@ui-sdk/react/primitive";
import { item } from "./item";

const {
  Root: ItemRoot,
  Icon: ItemIcon,
  Label: ItemLabel,
  Input: ItemInput,
  Status: ItemStatus,
} = createParts(item, {
  icon: "span",
  label: "span",
  input: "input",
  status: "span",
});

export { ItemIcon, ItemInput, ItemLabel, ItemRoot, ItemStatus };
