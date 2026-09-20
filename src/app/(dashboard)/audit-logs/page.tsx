'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/lib/utils/date';

interface AuditEntry {
  _id: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  EMERGENCY_CREATED: 'bg-red-500/10 text-red-400',
  MATCHING_STARTED: 'bg-blue-500/10 text-blue-400',
  MATCH_ACCEPTED: 'bg-emerald-500/10 text-emerald-400',
  MATCH_DECLINED: 'bg-amber-500/10 text-amber-400',
  REQUEST_FULFILLED: 'bg-emerald-500/10 text-emerald-400',
  REQUEST_CANCELLED: 'bg-gray-500/10 text-gray-400',
  INVENTORY_UPDATED: 'bg-blue-500/10 text-blue-400',
  ENTITY_VERIFIED: 'bg-emerald-500/10 text-emerald-400',
  USER_REGISTERED: 'bg-purple-500/10 text-purple-400',
  ESCALATION_TRIGGERED: 'bg-amber-500/10 text-amber-400',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterAction !== 'all') params.set('action', filterAction);
      if (filterEntity !== 'all') params.set('entityType', filterEntity);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete record of all system actions and state changes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v ?? ''); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="EMERGENCY_CREATED">Emergency Created</SelectItem>
              <SelectItem value="MATCHING_STARTED">Matching Started</SelectItem>
              <SelectItem value="MATCH_ACCEPTED">Match Accepted</SelectItem>
              <SelectItem value="MATCH_DECLINED">Match Declined</SelectItem>
              <SelectItem value="REQUEST_FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="INVENTORY_UPDATED">Inventory Updated</SelectItem>
              <SelectItem value="ENTITY_VERIFIED">Entity Verified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v ?? ''); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="EmergencyRequest">Emergency Request</SelectItem>
              <SelectItem value="Match">Match</SelectItem>
              <SelectItem value="Inventory">Inventory</SelectItem>
              <SelectItem value="User">User</SelectItem>
              <SelectItem value="Verification">Verification</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log List */}
      <Card className="divide-y divide-border">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log._id} className="p-4 flex items-start gap-4 hover:bg-muted/20 transition-colors">
              <div className="shrink-0 mt-0.5">
                <Badge className={`text-[10px] ${ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}`}>
                  {log.action.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{log.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{log.userName}</span>
                  <span>·</span>
                  <span>{log.userRole}</span>
                  <span>·</span>
                  <span>{log.entityType}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {timeAgo(log.createdAt)}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
