'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  AlertTriangle,
  Plus,
  Map,
  Bell,
  BarChart3,
  Shield,
  FileText,
  Settings,
  LogOut,
  Droplets,
  Users,
  Heart,
  Package,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Command Center',
    href: '/command-center',
    icon: LayoutDashboard,
  },
  {
    label: 'Emergencies',
    href: '/emergencies',
    icon: AlertTriangle,
  },
  {
    label: 'Create Emergency',
    href: '/emergencies/new',
    icon: Plus,
    roles: ['HOSPITAL', 'ADMIN'],
  },
  {
    label: 'Resource Map',
    href: '/map',
    icon: Map,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['BLOOD_BANK', 'ADMIN'],
  },
  {
    label: 'Donor Network',
    href: '/donors',
    icon: Heart,
    roles: ['ADMIN', 'HOSPITAL'],
  },
  {
    label: 'My Availability',
    href: '/donor/availability',
    icon: Activity,
    roles: ['DONOR'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'],
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    label: 'Verification',
    href: '/verification',
    icon: Shield,
    roles: ['ADMIN'],
  },
  {
    label: 'Blood Bank Status',
    href: '/blood-banks/status',
    icon: Activity,
    roles: ['ADMIN'],
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: FileText,
    roles: ['ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const roleLabels: Record<string, string> = {
    HOSPITAL: 'Hospital',
    BLOOD_BANK: 'Blood Bank',
    DONOR: 'Donor',
    ADMIN: 'Admin',
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar flex flex-col">
      {/* Logo Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <Droplets className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">
            RAKTHSETU
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
            Emergency Network
          </p>
        </div>
      </div>

      {/* System Status */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            SYSTEM OPERATIONAL
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/command-center' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-border px-4 py-3">
        {user && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {roleLabels[user.role] || user.role}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
