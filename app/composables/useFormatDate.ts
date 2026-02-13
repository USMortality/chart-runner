export function useFormatDate() {
  function formatDate(iso: string | null | undefined): string {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return { formatDate };
}
