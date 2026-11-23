import type { ComponentProps } from "react";
import { FileListView } from "../components/file-list-view/file-list-view";

type Props = ComponentProps<typeof FileListView>;

export function checkLayoutProps(
  props: Omit<Props, "layout" | "defaultPositions">,
) {
  <FileListView {...props} layout="spatial" defaultPositions={{}} />;
  <FileListView {...props} layout="grid" />;
  <FileListView {...props} layout="vertical" />;

  // @ts-expect-error Spatial layout requires starting positions.
  <FileListView {...props} layout="spatial" />;
  // @ts-expect-error Grid layout does not accept positions.
  <FileListView {...props} layout="grid" defaultPositions={{}} />;
  // @ts-expect-error Vertical layout does not accept positions.
  <FileListView {...props} layout="vertical" defaultPositions={{}} />;
}
