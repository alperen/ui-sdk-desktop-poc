import {
  SegmentedControl,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Columns3, LayoutGrid, List } from "lucide-react";

export type FolderView = "grid" | "list" | "columns";

interface ViewLayoutControlProps {
  label: string;
  layout: FolderView;
  onChange: (layout: FolderView) => void;
}

export function ViewLayoutControl({
  label,
  layout,
  onChange,
}: ViewLayoutControlProps) {
  return (
    <SegmentedControl
      aria-label={label}
      value={layout}
      onValueChange={(value) => {
        if (value === "grid" || value === "list" || value === "columns")
          onChange(value);
      }}
      className="folder-view-controls mr-2 flex shrink-0 gap-0.5 rounded-md border border-border bg-surface p-0.5"
    >
      <SegmentedControlItem
        value="grid"
        aria-label="Grid view"
        title="Grid view"
        className="window-control"
      >
        <LayoutGrid
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          absoluteStrokeWidth
        />
      </SegmentedControlItem>
      <SegmentedControlItem
        value="list"
        aria-label="List view"
        title="List view"
        className="window-control"
      >
        <List
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          absoluteStrokeWidth
        />
      </SegmentedControlItem>
      <SegmentedControlItem
        value="columns"
        aria-label="Columns view"
        title="Columns view"
        className="window-control"
      >
        <Columns3
          aria-hidden="true"
          size={16}
          strokeWidth={2}
          absoluteStrokeWidth
        />
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
