import { createContext, type RefObject } from "react";

const ItemEditContext = createContext<RefObject<(() => void) | null> | null>(
  null,
);

export { ItemEditContext };
