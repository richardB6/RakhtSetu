'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Search, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function TopBar() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.data?.count || 0);
        }
      } catch {
        // Silently fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, []);

  const roleLabels: Record<string, string> = {
    HOSPITAL: 'Hospital Operations',
    BLOOD_BANK: 'Blood Bank Operations',
    DONOR: 'Donor Portal',
    ADMIN: 'System Administration',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl md:px-6">
      {/* Left: Context info */}
        <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium tracking-wide">
            {user ? roleLabels[user.role] || 'Dashboard' : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Time */}
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="text-border">|</span>
          <span className="font-mono">{currentTime.toLocaleTimeString('en-IN', { hour12: false })}</span>
        </div>

        {/* Search shortcut */}
        <button aria-label="Open search" className="focus-control hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent md:flex">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd>
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
          className="focus-control relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] font-bold flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Link>

        {/* User avatar */}
        {user && (
          <Link
            href="/profile"
            className="focus-control flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary"
          >
            {user.name.charAt(0).toUpperCase()}
          </Link>
        )}
      </div>
    </header>
  );
}
