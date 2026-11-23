import { useRef } from "react";
import { useAgent } from "../../agent";
import { ControlIcon } from "../control-icon/control-icon";

export type FolderView = "grid" | "list" | "columns";
const views: FolderView[] = ["grid", "list", "columns"];
export function ViewLayoutControl({
  label,
  layout,
  onChange,
}: {
  label: string;
  layout: FolderView;
  onChange: (view: FolderView) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useAgent(root, {
    component: "segmented-control",
    label,
    actions: {
      setValue: (value: string) => {
        if (views.includes(value as FolderView)) onChange(value as FolderView);
      },
    },
  });
  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label={label}
      className="folder-view-controls"
      onKeyDown={(event) => {
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const previous = event.key === (rtl ? "ArrowRight" : "ArrowLeft");
        const next = event.key === (rtl ? "ArrowLeft" : "ArrowRight");
        if (!previous && !next && event.key !== "Home" && event.key !== "End")
          return;
        event.preventDefault();
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 2
              : (views.indexOf(layout) + (previous ? 2 : 1)) % 3;
        onChange(views[index]);
        event.currentTarget
          .querySelectorAll<HTMLButtonElement>("button")
          [index].focus();
      }}
    >
      {views.map((view) => (
        // biome-ignore lint/a11y/useSemanticElements: Button radios preserve the segmented control interaction and focus contract.
        <button
          type="button"
          key={view}
          role="radio"
          aria-checked={view === layout}
          aria-label={`${view === "grid" ? "Grid" : view === "list" ? "List" : "Columns"} view`}
          title={`${view === "grid" ? "Grid" : view === "list" ? "List" : "Columns"} view`}
          className="window-control"
          tabIndex={view === layout ? 0 : -1}
          onClick={() => onChange(view)}
        >
          <ControlIcon name={view} />
        </button>
      ))}
    </div>
  );
}
