export type EventItemType = "tool" | "workflow";
export type EventItemStatus = "pending" | "success" | "error";
export interface ToolEventItemViewModel {
  id: string;
  type: EventItemType;
  name: string;
  status: EventItemStatus;
  args: unknown | null;
}
export interface PosterPreviewViewModel {
  versionId: string;
  versionNo?: number;
  createdAt?: string;
}
