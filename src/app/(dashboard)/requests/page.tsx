'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Droplets,
  MapPin,
  Phone,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { COMPONENT_LABELS } from '@/lib/engine/compatibility';
import { elapsedTime } from '@/lib/utils/date';
import Link from 'next/link';

interface EmergencyRef {
  requestId: string;
  bloodGroup: string;
  component: string;
  quantity: number;
  quantityFulfilled?: number;
  severity: 'CRITICAL' | 'HIGH' | 'NORMAL';
  status: string;
  city: string;
  requiredBy: string;
  createdAt: string;
  contactPerson?: string;
  contactPhone?: string;
}

interface MatchEntry {
  _id: string;
  emergencyRequestId: EmergencyRef | string;
  resourceType: 'BLOOD_BANK' | 'DONOR';
  status: 'PENDING' | 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'RESERVED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  score: number;
  distanceKm: number;
  availableQuantity: number;
  compatibilityType: string;
  createdAt: string;
  respondedAt?: string;
  declineReason?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-700',
  HIGH: 'bg-amber-50 border-amber-200 text-amber-700',
  NORMAL: 'bg-accent border-border text-accent-foreground',
};

const STATUS_BADGE: Record<string, string> = {
  NOTIFIED:  'bg-accent border-border text-accent-foreground',
  PENDING:   'bg-amber-50 border-amber-200 text-amber-700',
  ACCEPTED:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  DECLINED:  'bg-muted border-border text-muted-foreground',
  RESERVED:  'bg-accent border-border text-accent-foreground',
  FULFILLED: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  CANCELLED: 'bg-muted border-border text-muted-foreground',
  EXPIRED:   'bg-red-50 border-red-200 text-red-600',
};

export default function BloodBankRequestsPage() {
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('actionable');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineFor, setShowDeclineFor] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus === 'actionable') {
        params.set('status', 'NOTIFIED,PENDING');
      } else if (filterStatus !== 'all') {
        params.set('status', filterStatus);
      }
      params.set('limit', '50');
      params.set('page', String(page));
      const res = await fetch(`/api/matches?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch requests');
      setMatches(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalMatches(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page]);

  useEffect(() => {
    void fetchMatches();
    const interval = setInterval(() => void fetchMatches(), 15000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  const respond = async (matchId: string, accept: boolean, reason?: string) => {
    setActionId(matchId);
    setMessage(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept, declineReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to respond');
      setMessage(accept ? '✓ Request accepted. Inventory reservation in progress.' : '✓ Request declined. System will escalate to next resource.');
      setShowDeclineFor(null);
      setDeclineReason('');
      await fetchMatches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setActionId(null);
    }
  };

  const getEmergency = (match: MatchEntry): EmergencyRef | null => {
    if (match.emergencyRequestId && typeof match.emergencyRequestId === 'object') {
      return match.emergencyRequestId as EmergencyRef;
    }
    return null;
  };

  const actionableCount = matches.filter(
    (m) => m.status === 'NOTIFIED' || m.status === 'PENDING'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Incoming Blood Requests</h1>
            {actionableCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {actionableCount}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Emergency requests matched to your blood bank — respond promptly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v ?? 'actionable'); setPage(1); }}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actionable">Needs Action</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
              <SelectItem value="RESERVED">Reserved</SelectItem>
              <SelectItem value="FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="all">All Matches</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : error && matches.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-destructive">Requests could not be loaded. Use Refresh to try again.</p>
        </Card>
      ) : matches.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {filterStatus === 'actionable'
              ? 'No pending requests right now. The matching engine will notify you when an emergency requires your blood bank.'
              : 'No matches found for this filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{totalMatches} matching requests</p>
          {matches.map((match) => {
            const emergency = getEmergency(match);
            const isActionable = match.status === 'NOTIFIED' || match.status === 'PENDING';
            const isActing = actionId === match._id;
            const severity = emergency?.severity || 'NORMAL';

            return (
              <Card
                key={match._id}
                className={`overflow-hidden border-l-4 ${
                  isActionable
                    ? severity === 'CRITICAL' ? 'border-l-red-500' : severity === 'HIGH' ? 'border-l-amber-500' : 'border-l-blue-500'
                    : 'border-l-border'
                }`}
              >
                <div className="p-4">
                  {/* Top row */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {isActionable && (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                        </span>
                      )}
                      <div>
                        <p className="font-mono font-semibold text-sm">
                          {emergency?.requestId || String(match.emergencyRequestId).slice(-8)}
                        </p>
                        {emergency && (
                          <p className="text-xs text-muted-foreground">
                            {emergency.city} · {elapsedTime(emergency.createdAt)} elapsed
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {emergency && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLORS[severity]}`}>
                          {severity}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[match.status] || ''}`}>
                        {match.status}
                      </span>
                    </div>
                  </div>

                  {/* Blood requirement */}
                  {emergency && (
                    <div className="flex flex-wrap items-center gap-4 mb-3 bg-muted/30 rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-lg font-bold text-primary">{emergency.bloodGroup}</span>
                        <span className="text-sm text-muted-foreground">
                          {COMPONENT_LABELS[emergency.component as keyof typeof COMPONENT_LABELS] || emergency.component}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{emergency.quantity}</span>
                        <span className="text-muted-foreground"> units required</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Required by: {new Date(emergency.requiredBy).toLocaleString()}
                      </div>
                      {emergency.contactPerson && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {emergency.contactPerson} · {emergency.contactPhone}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {match.distanceKm.toFixed(1)} km away
                      </div>
                    </div>
                  )}

                  {/* Match meta */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                    <span>Match score: <strong>{match.score}</strong></span>
                    <span>·</span>
                    <span>Compatibility: <strong>{match.compatibilityType?.replace(/_/g, ' ')}</strong></span>
                    <span>·</span>
                    {(() => {
                      const needed = emergency
                        ? Math.max(1, emergency.quantity - (emergency.quantityFulfilled || 0))
                        : 1;
                      const insufficient = match.availableQuantity < needed;
                      return (
                        <span className={insufficient ? 'text-destructive' : ''}>
                          {match.availableQuantity <= 0
                            ? 'No stock available'
                            : insufficient
                              ? `Insufficient stock — ${match.availableQuantity} of ${needed} units available`
                              : <>Your available stock: <strong>{match.availableQuantity} units</strong></>}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Decline reason input */}
                  {showDeclineFor === match._id && (
                    <div className="mb-3 space-y-2">
                      <input
                        type="text"
                        placeholder="Optional: reason for declining (e.g. Out of stock)"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isActionable ? (
                      <>
                        {showDeclineFor === match._id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isActing}
                              onClick={() => respond(match._id, false, declineReason || undefined)}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Confirm Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isActing}
                              onClick={() => { setShowDeclineFor(null); setDeclineReason(''); }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="bg-primary text-primary-foreground"
                              disabled={isActing || (match.resourceType === 'BLOOD_BANK' && !!emergency &&
                                match.availableQuantity < Math.max(1, emergency.quantity - (emergency.quantityFulfilled || 0)))}
                              onClick={() => respond(match._id, true)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              {isActing ? 'Processing...' : 'Accept Request'}
                            </Button>
                            {match.resourceType === 'BLOOD_BANK' && emergency &&
                              match.availableQuantity < Math.max(1, emergency.quantity - (emergency.quantityFulfilled || 0)) && (
                                <span className="text-xs text-destructive">Cannot accept — insufficient stock</span>
                              )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isActing}
                              onClick={() => setShowDeclineFor(match._id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Decline
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {match.status === 'ACCEPTED' && '✓ You accepted this request. Inventory reserved.'}
                        {match.status === 'DECLINED' && `✗ Declined${match.declineReason ? ': ' + match.declineReason : ''}`}
                        {match.status === 'RESERVED' && '✓ Inventory reserved for this emergency.'}
                        {match.status === 'FULFILLED' && '✓ This request was fulfilled.'}
                        {match.status === 'CANCELLED' && 'This request was cancelled.'}
                        {match.status === 'EXPIRED' && 'This match expired.'}
                      </span>
                    )}
                    {emergency && (
                      <Link href={`/emergencies/${typeof match.emergencyRequestId === 'string' ? match.emergencyRequestId : (match.emergencyRequestId as any)._id}`}>
                        <Button size="sm" variant="ghost" className="text-xs">
                          View Emergency →
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || loading}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Response time matters.</strong> Emergency requests have a time window. If you decline,
          the system will automatically escalate to the next available blood bank.
          Accepting reserves the required units from your inventory.
        </div>
      </div>
    </div>
  );
}
