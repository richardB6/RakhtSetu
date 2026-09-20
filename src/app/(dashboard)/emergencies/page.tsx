'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Eye, Filter } from 'lucide-react';
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
import { IEmergencyRequest } from '@/types';
import { COMPONENT_LABELS, BLOOD_GROUPS, COMPONENT_TYPES, SEVERITY_LEVELS, REQUEST_STATUSES } from '@/lib/engine/compatibility';
import { elapsedTime } from '@/lib/utils/date';

export default function EmergenciesListPage() {
  const [requests, setRequests] = useState<IEmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [bloodGroup, setBloodGroup] = useState('ALL');
  const [component, setComponent] = useState('ALL');

  const fetchRequests = async () => {
    try {
      // Build query string
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (severity !== 'ALL') params.append('severity', severity);
      if (status !== 'ALL') params.append('status', status);
      if (bloodGroup !== 'ALL') params.append('bloodGroup', bloodGroup);
      if (component !== 'ALL') params.append('component', component);

      const res = await fetch(`/api/emergencies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRequests(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch emergencies', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [search, severity, status, bloodGroup, component]);

  const getPriorityColor = (level: string) => {
    switch(level) {
      case 'CRITICAL': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      case 'HIGH': return 'bg-amber-500';
      case 'NORMAL': return 'bg-blue-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusBadge = (reqStatus: string) => {
    let classes = "px-2.5 py-0.5 rounded-full text-xs font-medium border ";
    switch(reqStatus) {
      case 'FULFILLED': classes += "bg-emerald-50 text-emerald-700 border-emerald-200"; break;
      case 'CANCELLED': classes += "bg-slate-100 text-slate-700 border-slate-200"; break;
      case 'MATCHING': classes += "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"; break;
      case 'ESCALATED': classes += "bg-red-50 text-red-700 border-red-200"; break;
      default: classes += "bg-amber-50 text-amber-700 border-amber-200";
    }
    return <span className={classes}>{reqStatus.replace('_', ' ')}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Emergency Board</h1>
          <p className="text-sm text-muted-foreground">Real-time tracking of all active network requests.</p>
        </div>
        <Link href="/emergencies/new">
          <Button className="bg-red-600 hover:bg-red-700">Create Emergency Request</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="ops-panel mb-6 flex flex-wrap items-center gap-4 rounded-md p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search Request ID..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={severity} onValueChange={(value) => setSeverity(value ?? '')}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Severities</SelectItem>
            {SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setStatus(value ?? '')}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {REQUEST_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={bloodGroup} onValueChange={(value) => setBloodGroup(value ?? '')}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Blood Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Groups</SelectItem>
            {BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={component} onValueChange={(value) => setComponent(value ?? '')}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Component" /></SelectTrigger>
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
                  <TableCell colSpan={8} className="h-16 text-center">
                    <div className="animate-pulse bg-slate-200 h-4 w-full rounded"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                  No emergency requests found matching the criteria.
                </TableCell>
              </TableRow>
            ) : (
              requests.map(req => (
                <TableRow key={req._id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(req.severity)}`} title={req.severity} />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-sm">{req.requestId || req._id.substring(0,8)}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{req.quantity}x {req.bloodGroup}</div>
                    <div className="text-xs text-slate-500">{COMPONENT_LABELS[req.component]}</div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate max-w-[200px]">{req.hospital?.name || 'Unknown Hospital'}</div>
                    <div className="text-xs text-slate-500">{req.city}</div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(req.status)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {elapsedTime(req.createdAt)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {req.matchCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/emergencies/${req._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-blue-600">
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
      
      {/* Pagination (Simple for now) */}
      <div className="mt-4 flex justify-between items-center text-sm text-slate-500">
        <div>Showing {requests.length} results</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" disabled>Next</Button>
        </div>
      </div>
    </div>
  );
}
