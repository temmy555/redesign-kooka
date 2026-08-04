export type FoodOrderStatus =
  | "ENTERED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type FoodOrderDisplayStatus = "IN_PROGRESS" | "DONE" | "CANCELLED";

const DISPLAY_STATUS: Record<FoodOrderStatus, FoodOrderDisplayStatus> = {
  ENTERED: "IN_PROGRESS",
  ACCEPTED: "IN_PROGRESS",
  PREPARING: "IN_PROGRESS",
  READY: "IN_PROGRESS",
  SERVED: "DONE",
  COMPLETED: "DONE",
  CANCELLED: "CANCELLED",
};

const DISPLAY_LABEL: Record<FoodOrderDisplayStatus, string> = {
  IN_PROGRESS: "Sedang diproses",
  DONE: "Selesai / disajikan",
  CANCELLED: "Dibatalkan",
};

const FILTER_STATUSES: Record<string, FoodOrderStatus[] | undefined> = {
  IN_PROGRESS: ["ENTERED", "ACCEPTED", "PREPARING", "READY"],
  DONE: ["SERVED", "COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

export function foodOrderDisplayStatus(status: string): FoodOrderDisplayStatus {
  return DISPLAY_STATUS[status as FoodOrderStatus] ?? "IN_PROGRESS";
}

export function foodOrderStatusLabel(status: string) {
  return DISPLAY_LABEL[foodOrderDisplayStatus(status)];
}

export function nextSimpleFoodOrderStatus(
  status: string,
): "SERVED" | undefined {
  if (["ENTERED", "ACCEPTED", "PREPARING", "READY"].includes(status))
    return "SERVED";
  return undefined;
}

export function nextSimpleFoodOrderAction(status: string) {
  const next = nextSimpleFoodOrderStatus(status);
  if (next === "SERVED") return "Tandai selesai / disajikan";
  return "";
}

export function foodOrderStatusesForFilter(filter: string) {
  return FILTER_STATUSES[filter];
}
