"use client";

import { createParts, type PartProps, usePart } from "@ui-sdk/react/primitive";
import { useRef } from "react";
import { ItemEditContext } from "../../contexts/item-edit-context";
import { list } from "./list";

const { Root: FileList, Lasso: FileListLasso } = createParts(list, {
  root: "div",
  lasso: "div",
});

interface FileListItemProps extends PartProps<"div"> {
  value: string;
  label: string;
}

function FileListItem({ value, label, ...props }: FileListItemProps) {
  const editor = useRef<(() => void) | null>(null);

  function startEditing() {
    editor.current?.();
  }

  const element = usePart(
    list,
    "item",
    { value, label, onEdit: startEditing },
    props,
    "div",
  );

  return <ItemEditContext value={editor}>{element}</ItemEditContext>;
}

export { FileList, FileListItem, FileListLasso };
