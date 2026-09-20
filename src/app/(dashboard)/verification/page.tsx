'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, CheckCircle, XCircle, User, Building2, Heart, PauseCircle } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';

interface VerificationEntry {
  _id: string;
  user: { _id: string; name: string; email: string; role: string };
  entityType: string;
  status: string;
  submittedDocuments: string[];
  verifiedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
}

export default function VerificationPage() {
  const [entries, setEntries] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('PENDING');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const query = filter === 'ALL' ? 'ALL' : filter;
      const res = await fetch(`/api/admin/verification?status=${query}&q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data || []);
      } else throw new Error((await res.json()).message || 'Unable to load verification entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load verification entries');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const updateVerification = async (entry: VerificationEntry, status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED') => {
    const reason = status === 'VERIFIED' ? undefined : window.prompt(`Reason for ${status.toLowerCase()}:`);
    if (status !== 'VERIFIED' && !reason) return;
    setActionLoading(entry._id);
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: entry.user._id, status, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Verification update failed');
      await fetchEntries();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Verification update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const entityIcon = (type: string) => {
    switch (type) {
      case 'HOSPITAL': return <Building2 className="w-4 h-4" />;
      case 'BLOOD_BANK': return <Shield className="w-4 h-4" />;
      case 'DONOR': return <Heart className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">Verified</Badge>;
      case 'PENDING': return <Badge className="bg-amber-500/10 text-amber-400 text-xs">Pending</Badge>;
      case 'REJECTED': return <Badge className="bg-red-500/10 text-red-400 text-xs">Rejected</Badge>;
      case 'SUSPENDED': return <Badge className="bg-gray-500/10 text-gray-400 text-xs">Suspended</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const filtered = entries;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verification Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage entity verification requests
          </p>
        </div>
        <div className="flex gap-2">
          {['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'ALL'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>
      <input className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" placeholder="Search name, email, role, or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
      {error && <Card className="border-destructive/30 p-4 text-sm text-destructive">{error}</Card>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">
            {entries.filter((e) => e.status === 'PENDING').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Verified</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">
            {entries.filter((e) => e.status === 'VERIFIED').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Rejected</p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {entries.filter((e) => e.status === 'REJECTED').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Entities</p>
          <p className="text-2xl font-bold mt-1">{entries.length}</p>
        </Card>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No verification entries found</p>
          </Card>
        ) : (
          filtered.map((entry) => (
            <Card key={entry._id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-muted/50">
                    {entityIcon(entry.entityType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{entry.user.name}</p>
                      {statusBadge(entry.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.user.email}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {entry.entityType.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Submitted {timeAgo(entry.createdAt)}
                      </span>
                      {entry.submittedDocuments.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · {entry.submittedDocuments.length} doc(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {entry.status === 'PENDING' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                      disabled={actionLoading === entry._id}
                      onClick={() => updateVerification(entry, 'VERIFIED')}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                      disabled={actionLoading === entry._id}
                      onClick={() => updateVerification(entry, 'REJECTED')}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={actionLoading === entry._id}
                      onClick={() => updateVerification(entry, 'SUSPENDED')}
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" />
                      Suspend
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
