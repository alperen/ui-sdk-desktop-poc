export type ListLayout = "spatial" | "vertical" | "grid";
export function createListController() {
  return {
    focusItem: (_key?: string, _select?: boolean) => {},
    getSelectedIds: (): string[] => [],
    editSelected: () => {},
    selectIfUnselected: (_key: string): string[] => [],
  };
}
