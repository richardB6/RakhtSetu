'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Clock, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface AnalyticsData {
  stats: {
    activeEmergencies: number;
    criticalRequests: number;
    avgResponseTimeMinutes: number | null;
    fulfillmentRate: number | null;
    totalFulfilled: number;
    matchingInProgress: number;
    medianResponseTimeMinutes: number | null;
    averageMatchingTimeMinutes: number | null;
    averageFulfillmentTimeMinutes: number | null;
    escalationRate: number | null;
    resourceResponseRate: number | null;
    resourceAcceptanceRate: number | null;
  };
  byDay: Array<{ _id: string; count: number }>;
  byStatus: Array<{ _id: string; count: number }>;
  bySeverity: Array<{ _id: string; count: number }>;
  byComponent: Array<{ _id: string; count: number }>;
  byBloodGroup: Array<{ _id: string; count: number }>;
  responseByDay: Array<{ _id: string; averageMinutes: number }>;
  byHour: Array<{ _id: number; count: number }>;
  byLocation: Array<{ _id: string; count: number }>;
  fulfillmentByResourceType: Array<{ _id: string; count: number }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days: period });
      if (period === 'custom' && from && to) { params.set('from', new Date(`${from}T00:00:00`).toISOString()); params.set('to', new Date(`${to}T23:59:59`).toISOString()); }
      const res = await fetch(`/api/analytics?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Emergency response metrics and operational insights
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={period} onValueChange={(value) => setPeriod(value ?? '7')}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">24 Hours</SelectItem>
            <SelectItem value="7">7 Days</SelectItem>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {period === 'custom' && <><input aria-label="Analytics start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" /><input aria-label="Analytics end date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" /></>}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-destructive/10">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            </div>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-2xl font-bold">{stats?.activeEmergencies || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-amber-500/10">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground">Avg Response</span>
          </div>
          <p className="text-2xl font-bold">
            {stats?.avgResponseTimeMinutes === null || stats?.avgResponseTimeMinutes === undefined ? 'Insufficient data' : `${Math.round(stats.avgResponseTimeMinutes)}m`}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Fulfillment</span>
          </div>
          <p className="text-2xl font-bold">
            {stats?.fulfillmentRate === null || stats?.fulfillmentRate === undefined ? 'Insufficient data' : `${stats.fulfillmentRate.toFixed(1)}%`}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Fulfilled</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalFulfilled || 0}</p>
        </Card>
        {[
          ['Median response', stats?.medianResponseTimeMinutes],
          ['Matching time', stats?.averageMatchingTimeMinutes],
          ['Fulfillment time', stats?.averageFulfillmentTimeMinutes],
          ['Escalation rate', stats?.escalationRate],
          ['Resource response', stats?.resourceResponseRate],
          ['Resource acceptance', stats?.resourceAcceptanceRate],
        ].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-xl font-bold">{value === null || value === undefined ? 'Insufficient data' : String(label).toLowerCase().includes('rate') || label === 'Escalation rate' ? `${Number(value).toFixed(1)}%` : `${Number(value).toFixed(1)}m`}</p></Card>)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emergencies Over Time */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Emergency Requests Over Time
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.byDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: '#999' }}
                />
                <Area type="monotone" dataKey="count" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* By Severity */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Requests by Severity</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bySeverity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data?.bySeverity || []).map((entry, idx) => (
                    <Cell key={idx} fill={entry._id === 'CRITICAL' ? '#ef4444' : entry._id === 'HIGH' ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* By Blood Group */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Demand by Blood Group</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byBloodGroup || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis dataKey="_id" type="category" tick={{ fontSize: 10, fill: '#888' }} width={40} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(data?.byBloodGroup || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* By Component */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Demand by Component</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.byComponent || []).map((entry) => ({ component: entry._id, count: entry.count }))}
                  dataKey="count"
                  nameKey="component"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(props) => {
                    const component = 'component' in props ? String(props.component) : '';
                    const percent = props.percent ?? 0;
                    return `${component} ${(percent * 100).toFixed(0)}%`;
                  }}
                  labelLine={false}
                  fontSize={10}
                >
                  {(data?.byComponent || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 6, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Requests by Status</h3>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.byStatus || []}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="_id" tick={{ fontSize: 9, fill: '#888' }} angle={-25} textAnchor="end" height={55} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Response Time Over Time</h3>
          {!data?.responseByDay?.length ? <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Insufficient data</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.responseByDay}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip /><Line type="monotone" dataKey="averageMinutes" stroke="#f59e0b" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Requests by Hour</h3>
          {!data?.byHour?.length ? <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Insufficient data</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.byHour}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b981" fillOpacity={0.15} /></AreaChart></ResponsiveContainer></div>}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Demand by Location</h3>
          {!data?.byLocation?.length ? <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Insufficient data</p> : <div className="h-56 space-y-2 overflow-y-auto">{data.byLocation.map((entry) => <div key={entry._id} className="flex items-center justify-between border-b py-2 text-sm"><span>{entry._id || 'Unknown location'}</span><Badge variant="outline">{entry.count}</Badge></div>)}</div>}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Fulfillment by Resource Type</h3>
          {!data?.fulfillmentByResourceType?.length ? <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Insufficient data</p> : <div className="h-56 space-y-2">{data.fulfillmentByResourceType.map((entry) => <div key={entry._id} className="flex items-center justify-between border-b py-3 text-sm"><span>{entry._id.replace('_', ' ')}</span><Badge variant="outline">{entry.count} fulfilled</Badge></div>)}</div>}
        </Card>
      </div>
    </div>
  );
}
