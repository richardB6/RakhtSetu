'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Eye, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { IEmergencyRequest } from '@/types';
import { COMPONENT_LABELS, BLOOD_GROUPS, COMPONENT_TYPES, SEVERITY_LEVELS, REQUEST_STATUSES } from '@/lib/engine/compatibility';
import { elapsedTime } from '@/lib/utils/date';

export default function EmergenciesListPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<IEmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [bloodGroup, setBloodGroup] = useState('ALL');
  const [component, setComponent] = useState('ALL');

  const fetchRequests = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (severity !== 'ALL') params.append('severity', severity);
      if (status !== 'ALL') params.append('status', status);
      if (bloodGroup !== 'ALL') params.append('bloodGroup', bloodGroup);
      if (component !== 'ALL') params.append('component', component);

      const res = await fetch(`/api/emergencies?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        // Show a clear error (e.g. "Hospital profile not found")
        setError(data.message || 'Unable to load emergency requests.');
        setRequests([]);
      } else {
        setRequests(data.data || []);
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error('Failed to fetch emergencies', err);
    } finally {
      setLoading(false);
    }
  }, [search, severity, status, bloodGroup, component]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const getPriorityColor = (level: string) => {
    switch(level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-amber-500';
      case 'NORMAL': return 'bg-primary/40';
      default: return 'bg-border';
    }
  };

  const getStatusBadge = (reqStatus: string) => {
    let classes = 'px-2.5 py-0.5 rounded-full text-xs font-medium border ';
    switch(reqStatus) {
      case 'FULFILLED': classes += 'bg-emerald-50 text-emerald-700 border-emerald-200'; break;
      case 'CANCELLED': classes += 'bg-muted text-muted-foreground border-border'; break;
      case 'MATCHING': classes += 'bg-accent text-accent-foreground border-border'; break;
      case 'RESOURCES_NOTIFIED': classes += 'bg-accent text-accent-foreground border-border'; break;
      case 'ESCALATED': classes += 'bg-red-50 text-red-700 border-red-200'; break;
      default: classes += 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return <span className={classes}>{reqStatus.replace(/_/g, ' ')}</span>;
  };

  const canCreate = user?.role === 'HOSPITAL' || user?.role === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Emergency Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of emergency blood requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchRequests(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          {canCreate && (
            <Link href="/emergencies/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Request
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-sm text-destructive">Unable to load emergencies</p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
            {error.includes('profile not found') && canCreate && (
              <p className="text-xs text-destructive/80 mt-2">
                Your hospital profile may not have been set up correctly. Try logging out and registering again, or contact support.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="ops-panel mb-6 flex flex-wrap items-center gap-3 rounded-md p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search request ID or city..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={severity} onValueChange={(value) => setSeverity(value ?? 'ALL')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Severities</SelectItem>
            {SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setStatus(value ?? 'ALL')}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {REQUEST_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={bloodGroup} onValueChange={(value) => setBloodGroup(value ?? 'ALL')}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Blood Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Groups</SelectItem>
            {BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={component} onValueChange={(value) => setComponent(value ?? 'ALL')}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Component" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Components</SelectItem>
            {COMPONENT_TYPES.map(c => <SelectItem key={c} value={c}>{COMPONENT_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="ops-panel overflow-hidden rounded-md">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-12 text-center">Pri</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Elapsed</TableHead>
              <TableHead className="text-center">Matches</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8} className="h-14">
                    <div className="animate-pulse bg-muted h-4 w-full rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {error ? 'Could not load requests.' : 'No emergency requests found matching the current filters.'}
                </TableCell>
              </TableRow>
            ) : (
              requests.map(req => (
                <TableRow key={req._id} className="transition-colors hover:bg-muted/20">
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(req.severity)}`} title={req.severity} />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-sm">
                    {req.requestId || req._id.substring(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{req.quantity}× {req.bloodGroup}</div>
                    <div className="text-xs text-muted-foreground">{COMPONENT_LABELS[req.component]}</div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate max-w-[200px]">{(req.hospital as any)?.name || 'Hospital'}</div>
                    <div className="text-xs text-muted-foreground">{req.city}</div>
                  </TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {elapsedTime(req.createdAt)}
                  </TableCell>
                  <TableCell className="text-center font-medium tabular-nums">
                    {req.matchCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/emergencies/${req._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-primary">
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
        <div>Showing {requests.length} result{requests.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" disabled>Next</Button>
        </div>
      </div>
    </div>
  );
}
