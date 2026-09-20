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
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Left: Context info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-medium">
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
        <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd>
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
            className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold"
          >
            {user.name.charAt(0).toUpperCase()}
          </Link>
        )}
      </div>
    </header>
  );
}
