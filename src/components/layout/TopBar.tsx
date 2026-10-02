'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Search, Activity, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  emergencies?: Array<{ _id: string; requestId: string; bloodGroup: string; severity: string; city: string }>;
  blood_banks?: Array<{ _id: string; name: string; city: string; state: string }>;
  donors?: Array<{ _id: string; bloodGroup: string; city: string; availabilityStatus: string; isAvailable: boolean }>;
  inventory?: Array<{ _id: string; bloodGroup: string; component: string; availableUnits: number }>;
}

export default function TopBar() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSearchResults(data.results);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const roleLabels: Record<string, string> = {
    HOSPITAL: 'Hospital Operations',
    BLOOD_BANK: 'Blood Bank Operations',
    DONOR: 'Donor Portal',
    ADMIN: 'System Administration',
  };

  const hasResults =
    searchResults &&
    (
      (searchResults.emergencies?.length ?? 0) +
      (searchResults.blood_banks?.length ?? 0) +
      (searchResults.donors?.length ?? 0) +
      (searchResults.inventory?.length ?? 0)
    ) > 0;

  return (
    <header className="app-header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-6">
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

        {/* Search */}
        <div className="relative" ref={searchRef}>
          <button
            id="topbar-search-btn"
            aria-label="Open search (press /)"
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="focus-control hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent md:flex"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd>
          </button>

          {/* Search dropdown */}
          {searchOpen && (
            <div className="absolute right-0 top-full mt-2 w-[480px] rounded-lg border border-border bg-card shadow-lg z-50">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                {searching ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <input
                  ref={inputRef}
                  id="topbar-search-input"
                  type="text"
                  placeholder="Search emergencies, blood banks, donors…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {!searchQuery || searchQuery.length < 2 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Type at least 2 characters to search
                  </p>
                ) : !hasResults ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {searching ? 'Searching…' : 'No results found'}
                  </p>
                ) : (
                  <div className="py-1">
                    {searchResults?.emergencies?.map((e) => (
                      <Link
                        key={e._id}
                        href={`/emergencies/${e._id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{e.requestId}</span>
                        <span className="font-medium">{e.bloodGroup} · {e.city}</span>
                        <Badge variant={e.severity === 'CRITICAL' ? 'destructive' : 'outline'} className="text-[10px]">
                          {e.severity}
                        </Badge>
                      </Link>
                    ))}
                    {searchResults?.blood_banks?.map((bb) => (
                      <div
                        key={bb._id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent cursor-default"
                      >
                        <span className="font-medium">{bb.name}</span>
                        <span className="text-xs text-muted-foreground">{bb.city}, {bb.state}</span>
                      </div>
                    ))}
                    {searchResults?.donors?.map((d) => (
                      <div
                        key={d._id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent cursor-default"
                      >
                        <span className="font-medium">{d.bloodGroup} Donor</span>
                        <span className="text-xs text-muted-foreground">{d.city}</span>
                        <Badge className={`text-[10px] ${d.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                          {d.availabilityStatus.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                    {searchResults?.inventory?.map((inv) => (
                      <div
                        key={inv._id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent cursor-default"
                      >
                        <span className="font-medium">{inv.bloodGroup} {inv.component.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">{inv.availableUnits} units available</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t px-3 py-2">
                <p className="text-[10px] text-muted-foreground">
                  Press <kbd className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to close
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <Link
          href="/notifications"
          id="topbar-notifications-link"
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
            id="topbar-profile-link"
            className="focus-control flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
          >
            {user.name.charAt(0).toUpperCase()}
          </Link>
        )}
      </div>
    </header>
  );
}
