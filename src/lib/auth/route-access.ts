export interface ProtectedRoute {
  prefix: string;
  roles: string[];
}

export const PROTECTED_ROUTES: ProtectedRoute[] = [
  { prefix: '/donor/availability', roles: ['DONOR'] },
  { prefix: '/donors', roles: ['ADMIN', 'BLOOD_BANK'] },
  { prefix: '/donor', roles: ['DONOR'] },
  { prefix: '/emergencies/new', roles: ['HOSPITAL'] },
  { prefix: '/requests', roles: ['BLOOD_BANK'] },
  { prefix: '/blood-bank/status', roles: ['BLOOD_BANK', 'ADMIN'] },
  { prefix: '/audit-logs', roles: ['ADMIN'] },
  { prefix: '/verification', roles: ['ADMIN'] },
  { prefix: '/blood-banks/status', roles: ['ADMIN'] },
  { prefix: '/command-center', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/emergencies', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/map', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/inventory', roles: ['ADMIN', 'BLOOD_BANK', 'HOSPITAL'] },
  { prefix: '/analytics', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] },
  { prefix: '/notifications', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/settings', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/profile', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
  { prefix: '/dashboard', roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR'] },
];

export function findProtectedRoute(pathname: string): ProtectedRoute | undefined {
  return PROTECTED_ROUTES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}