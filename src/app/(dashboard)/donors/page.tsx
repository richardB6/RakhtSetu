'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MapPin, Calendar, RefreshCw, Search, AlertCircle, Phone } from 'lucide-react';
import { BLOOD_GROUPS } from '@/lib/engine/compatibility';
import { useAuth } from '@/contexts/AuthContext';
import type { BloodGroup } from '@/types';

interface DonorEntry {
  _id: string;
  userId?: { name: string; email?: string; phone?: string; verificationStatus?: string };
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  availabilityStatus: string;
  availabilityRadius: number;
  city: string;
  state: string;
  lastDonationDate?: string | null;
  totalDonations?: number;
  gender?: string | null;
  emergencyNotificationsEnabled: boolean;
}

interface GroupStats { [group: string]: { total: number; available: number } }

export default function DonorsPage() {
  const { user } = useAuth();
  const [donors, setDonors] = useState<DonorEntry[]>([]);
  const [groupStats, setGroupStats] = useState<GroupStats>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState('all');
  const [filterAvailability, setFilterAvailability] = useState('all');

  // Debounce search input to avoid a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDonors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '60' });
      if (filterBloodGroup !== 'all') params.set('bloodGroup', filterBloodGroup);
      if (filterAvailability !== 'all') params.set('availability', filterAvailability);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/donors?${params}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message ?? 'Unable to load donor network');

      setDonors(payload.data ?? []);
      setTotalCount(payload.total ?? 0);
      if (payload.groupStats) setGroupStats(payload.groupStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donors');
    } finally {
      setLoading(false);
    }
  }, [filterBloodGroup, filterAvailability, debouncedSearch]);

  useEffect(() => { void fetchDonors(); }, [fetchDonors]);

  const isAdmin = user?.role === 'ADMIN';
  const isBloodBank = user?.role === 'BLOOD_BANK';
  const availableCount = donors.filter((d) => d.isAvailable).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" /> Donor Network
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? '…' : `${totalCount} registered · ${availableCount} available in current view`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDonors} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Select value={filterBloodGroup} onValueChange={(v) => setFilterBloodGroup(v ?? 'all')}>
            <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="Blood group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAvailability} onValueChange={(v) => setFilterAvailability(v ?? 'all')}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Availability" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by city, state, or donor name…"
          className="h-10 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={fetchDonors}>Retry</Button>
        </div>
      )}

      {/* Blood group quick-filter grid */}
      <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {BLOOD_GROUPS.map((bg) => {
          const stats = groupStats[bg] ?? { available: 0, total: 0 };
          const selected = filterBloodGroup === bg;
          return (
            <Card
              key={bg}
              onClick={() => setFilterBloodGroup(selected ? 'all' : bg)}
              className={`cursor-pointer p-3 text-center transition-all ${selected ? 'border-primary bg-primary/10 shadow-sm' : 'hover:bg-muted/40'}`}
            >
              <p className="text-base font-bold">{bg}</p>
              <p className="mt-0.5 text-xs">
                <span className="font-semibold text-emerald-500">{stats.available}</span>
                <span className="text-muted-foreground">/{stats.total}</span>
              </p>
            </Card>
          );
        })}
      </div>

      {/* Donor grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      ) : error && donors.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="font-medium text-destructive">Donor network could not be loaded</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchDonors}>Retry</Button>
        </Card>
      ) : donors.length === 0 ? (
        <Card className="p-12 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No donors found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterBloodGroup !== 'all' || filterAvailability !== 'all' || debouncedSearch
              ? 'No donors match the current filters.'
              : 'No donors are registered yet.'}
          </p>
          {(filterBloodGroup !== 'all' || filterAvailability !== 'all' || search) && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setFilterBloodGroup('all'); setFilterAvailability('all'); setSearch(''); }}>
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {donors.map((donor) => (
            <Card key={donor._id} className="p-5 transition-colors hover:border-primary/40">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-sm text-primary">
                    {donor.bloodGroup}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{isBloodBank ? 'Available donor' : donor.userId?.name ?? 'Anonymous Donor'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{donor.city}, {donor.state}</p>
                  </div>
                </div>
                <Badge
                  className={`text-xs ${donor.isAvailable ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-border bg-muted text-muted-foreground'}`}
                  variant="outline"
                >
                  {donor.isAvailable ? 'Available' : 'Unavailable'}
                </Badge>
              </div>

              <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Radius</span>
                  <span className="font-medium text-foreground">{donor.availabilityRadius} km</span>
                </div>
                {isAdmin && <div className="flex justify-between">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Donations</span>
                  <span className="font-medium text-foreground">{donor.totalDonations ?? 0}</span>
                </div>}
                {isAdmin && donor.lastDonationDate && (
                  <div className="flex justify-between">
                    <span>Last donation</span>
                    <span className="font-medium text-foreground">{new Date(donor.lastDonationDate).toLocaleDateString()}</span>
                  </div>
                )}
                {/* Phone shown to admin or if donor has alerts enabled */}
                {donor.userId?.phone && (
                  <div className="flex justify-between pt-1 border-t mt-1">
                    <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> Contact</span>
                    <span className="font-mono font-medium text-foreground">{donor.userId.phone}</span>
                  </div>
                )}
                {isAdmin && donor.userId?.email && (
                  <div className="flex justify-between">
                    <span>Email</span>
                    <span className="font-medium text-foreground truncate max-w-[160px]">{donor.userId.email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span>Emergency alerts</span>
                  <span className={`font-medium ${donor.emergencyNotificationsEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                    {donor.emergencyNotificationsEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
