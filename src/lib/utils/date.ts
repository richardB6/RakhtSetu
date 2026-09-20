import { format, formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns';

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm:ss');
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function elapsedTime(startDate: Date | string): string {
  const start = new Date(startDate);
  const now = new Date();
  const mins = differenceInMinutes(now, start);

  if (mins < 60) {
    return `${mins}m`;
  }

  const hrs = differenceInHours(now, start);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

export function formatElapsedMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h ${mins}m`;
}
