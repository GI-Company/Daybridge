/**
 * DayBridge Date & Time Utilities
 */

export function formatTime(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getRelativeDayLabel(dateStr: string | Date): string {
  const target = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();

  const isToday =
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    target.getDate() === tomorrow.getDate() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getFullYear() === tomorrow.getFullYear();

  if (isTomorrow) return 'Tomorrow';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    target.getDate() === yesterday.getDate() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return target.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getTodayGreeting(name?: string): string {
  const hour = new Date().getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good afternoon';
  } else if (hour >= 17) {
    timeGreeting = 'Good evening';
  }
  return name ? `${timeGreeting}, ${name}` : timeGreeting;
}
