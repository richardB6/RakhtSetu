export function getCommandCenterWindow(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export function calculatePercentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export function getResponseStatus(statuses: string[]) {
  if (statuses.some((status) => ['ACCEPTED', 'RESERVED', 'FULFILLED'].includes(status))) return 'RESPONDED';
  if (statuses.includes('NOTIFIED')) return 'NOTIFIED';
  return 'WAITING';
}

export function getCommandCenterRange(days: number, from?: string, to?: string, now = new Date()) {
  const defaultSince = getCommandCenterWindow(days, now);
  const parsedSince = from ? new Date(from) : defaultSince;
  const parsedUntil = to ? new Date(to) : now;
  return {
    since: Number.isNaN(parsedSince.getTime()) ? defaultSince : parsedSince,
    until: Number.isNaN(parsedUntil.getTime()) ? now : parsedUntil,
  };
}

export function canViewRoleDashboard(role: string, dashboard: 'HOSPITAL' | 'BLOOD_BANK') {
  return role === 'ADMIN' || role === dashboard;
}