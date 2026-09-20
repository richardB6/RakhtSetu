'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, CheckCircle, XCircle, Clock, User, Building2, Heart } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';

interface VerificationEntry {
  _id: string;
  userId: { _id: string; name: string; email: string; role: string };
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

  const fetchEntries = useCallback(async () => {
    try {
      // We'll use a direct query since we don't have a dedicated verification API yet
      // For now, fetch users with their verification status
      const res = await fetch(`/api/auth/me`);
      if (res.ok) {
        // Fallback: show placeholder entries from seed data
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Simulate loading with seed data
    setTimeout(() => {
      setEntries([
        {
          _id: '1',
          userId: { _id: 'u1', name: 'KEM Hospital', email: 'hospital@demo.rakthsetu.in', role: 'HOSPITAL' },
          entityType: 'HOSPITAL',
          status: 'VERIFIED',
          submittedDocuments: ['Registration Certificate', 'Operating License'],
          verifiedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
        {
          _id: '2',
          userId: { _id: 'u2', name: 'Maharashtra State Blood Bank', email: 'bloodbank@demo.rakthsetu.in', role: 'BLOOD_BANK' },
          entityType: 'BLOOD_BANK',
          status: 'VERIFIED',
          submittedDocuments: ['CDSCO License', 'FDA Certificate'],
          verifiedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
        },
        {
          _id: '3',
          userId: { _id: 'u3', name: 'Rajesh Kumar', email: 'donor@demo.rakthsetu.in', role: 'DONOR' },
          entityType: 'DONOR',
          status: 'VERIFIED',
          submittedDocuments: ['Aadhaar Card', 'Medical Fitness'],
          verifiedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          _id: '4',
          userId: { _id: 'u4', name: 'City General Hospital', email: 'city.gen@hospital.in', role: 'HOSPITAL' },
          entityType: 'HOSPITAL',
          status: 'PENDING',
          submittedDocuments: ['Registration Certificate'],
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
          _id: '5',
          userId: { _id: 'u5', name: 'Priya Sharma', email: 'priya.s@donor.in', role: 'DONOR' },
          entityType: 'DONOR',
          status: 'PENDING',
          submittedDocuments: ['ID Proof'],
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

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

  const filtered = filter === 'ALL' ? entries : entries.filter((e) => e.status === filter);

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
          {['PENDING', 'VERIFIED', 'REJECTED', 'ALL'].map((f) => (
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
                      <p className="text-sm font-medium">{entry.userId.name}</p>
                      {statusBadge(entry.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.userId.email}</p>
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
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                      disabled={actionLoading === entry._id}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject
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
