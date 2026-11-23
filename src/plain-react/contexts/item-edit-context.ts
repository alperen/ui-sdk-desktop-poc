import { createContext, type RefObject } from "react";

export const ItemEditContext = createContext<RefObject<
  (() => void) | null
> | null>(null);
