export function formatCountdown(deadline: Date, now: Date = new Date()): string | null {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) {
    return null;
  }
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days} j ${hours % 24} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes % 60} min`;
  }
  return `${minutes} min`;
}
