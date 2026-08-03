export function safeStaffDestination(value: string | undefined) {
  if (!value || !value.startsWith("/staff") || value.startsWith("//")) {
    return "/staff";
  }
  return value;
}
