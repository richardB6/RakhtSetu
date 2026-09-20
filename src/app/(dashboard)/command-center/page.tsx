'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Zap,
  Activity,
  Package,
  Clock,
  CheckCircle,
  ExternalLink,
  MapPin,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo, formatTime, formatElapsedMinutes } from '@/lib/utils/date';
import type { IEmergencyRequest, INotification, DashboardStats } from '@/types';

// API Response Types
interface EmergenciesResponse {
  success: boolean;
  data: IEmergencyRequest[];
}

interface AnalyticsResponse {
  success: boolean;
  data: DashboardStats;
}

interface NotificationsResponse {
  success: boolean;
  data: INotification[];
}

export default function CommandCenterPage() {
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [emergencies, setEmergencies] = useState<IEmergencyRequest[]>([]);
  const [alerts, setAlerts] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, emergenciesRes, alertsRes] = await Promise.all([
        fetch('/api/analytics').then((r) => r.json()),
        fetch('/api/emergencies?limit=10&page=1').then((r) => r.json()),
        fetch('/api/notifications?limit=8').then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (emergenciesRes.success) setEmergencies(emergenciesRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch command center data:', err);
      setError('Unable to load live data. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // SWR-like polling pattern
    const statsInterval = setInterval(() => {
      fetch('/api/analytics')
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setStats(res.data);
        })
        .catch(console.error);
    }, 15000);

    const emergenciesInterval = setInterval(() => {
      fetch('/api/emergencies?limit=10&page=1')
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setEmergencies(res.data);
        })
        .catch(console.error);
      
      fetch('/api/notifications?limit=8')
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setAlerts(res.data);
        })
        .catch(console.error);
    }, 10000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(emergenciesInterval);
    };
  }, []);

  const formatMinSec = (totalMinutes: number) => {
    const mins = Math.floor(totalMinutes);
    const secs = Math.round((totalMinutes - mins) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statCards = [
    {
      title: 'ACTIVE EMERGENCIES',
      value: stats?.activeEmergencies ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'CRITICAL REQUESTS',
      value: stats?.criticalRequests ?? 0,
      icon: Zap,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'MATCHING IN PROGRESS',
      value: stats?.matchingInProgress ?? 0,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'AVAILABLE RESOURCES',
      value: stats?.availableResources ?? 0,
      icon: Package,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      title: 'AVG RESPONSE',
      value: stats ? formatMinSec(stats.avgResponseTimeMinutes) : '00:00',
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'FULFILLMENT RATE',
      value: stats ? `${stats.fulfillmentRate}%` : '0%',
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time emergency operations and resource coordination.
          </p>
        </div>
        {error && (
          <div className="text-xs font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            {error}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="rounded-md border-border/50">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat, i) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="rounded-md border-border/50 bg-card overflow-hidden h-full">
                  <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-2/3 leading-tight">
                        {stat.title}
                      </p>
                      <div className={cn('p-2 rounded-full', stat.bgColor)}>
                        <stat.icon className={cn('w-4 h-4', stat.color)} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left - Emergency Board */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">LIVE EMERGENCY BOARD</h2>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>

          <Card className="rounded-md border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Req ID</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Elapsed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : emergencies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No active emergencies.
                      </td>
                    </tr>
                  ) : (
                    emergencies.map((req) => (
                      <tr 
                        key={req._id} 
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          <Link href={`/emergencies/${req._id}`} className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              req.severity === 'CRITICAL' ? 'bg-red-500' :
                              req.severity === 'HIGH' ? 'bg-amber-500' : 'bg-blue-500'
                            )} />
                            {req.requestId || req._id.substring(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/emergencies/${req._id}`}>
                            <Badge variant="outline" className="font-semibold bg-background">
                              {req.bloodGroup} {req.component}
                            </Badge>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {req.quantityFulfilled}/{req.quantity}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/emergencies/${req._id}`}>
                            <Badge className={cn(
                              "text-[10px] tracking-wide",
                              req.status === 'CRITICAL' || req.status === 'OPEN' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' :
                              req.status === 'MATCHING' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                              req.status === 'FULFILLED' ? 'bg-green-500 hover:bg-green-600 text-white' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {req.status}
                            </Badge>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                          <Link href={`/emergencies/${req._id}`} className="flex justify-end items-center gap-2">
                            {timeAgo(req.createdAt)}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right - Critical Alerts & Activity */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight uppercase">Critical Alerts</h2>
          
          <Card className="rounded-md border-border/50 h-[300px] overflow-y-auto">
            <div className="flex flex-col divide-y divide-border/50">
              {loading ? (
                 Array.from({ length: 4 }).map((_, i) => (
                   <div key={i} className="p-4 flex gap-3">
                     <Skeleton className="w-1 h-10 rounded-full" />
                     <div className="flex-1 space-y-2">
                       <Skeleton className="h-3 w-16" />
                       <Skeleton className="h-4 w-full" />
                     </div>
                   </div>
                 ))
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No recent alerts.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert._id} className="p-3 flex gap-3 hover:bg-muted/30 transition-colors">
                    <div className={cn(
                      "w-1 rounded-full shrink-0",
                      alert.severity === 'CRITICAL' ? 'bg-red-500' :
                      alert.severity === 'HIGH' ? 'bg-orange-500' :
                      'bg-blue-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {formatTime(alert.createdAt)}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 rounded-sm border-muted-foreground/30 text-muted-foreground">
                          {alert.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium truncate text-foreground">
                        {alert.title}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <h2 className="text-lg font-semibold tracking-tight uppercase mt-2">Live Response Activity</h2>
          <Card className="rounded-md border-border/50 flex-1 min-h-[150px] p-4">
            <div className="relative border-l-2 border-muted ml-3 space-y-4">
               {/* Mocking some activity since audit logs aren't exposed in the requirements via a specific API */}
               {emergencies.slice(0, 3).map((req, i) => (
                 <div key={`act-${i}`} className="relative pl-4">
                   <div className="absolute w-2 h-2 bg-background border-2 border-primary rounded-full -left-[5px] top-1.5" />
                   <p className="text-xs text-muted-foreground">{timeAgo(req.updatedAt)}</p>
                   <p className="text-sm font-medium">
                     {req.status === 'MATCHING' ? `Matching initiated for ${req.bloodGroup} ${req.component}` : 
                      req.status === 'FULFILLED' ? `Request ${req.requestId} fulfilled` :
                      `Emergency ${req.requestId} created`}
                   </p>
                 </div>
               ))}
               {!loading && emergencies.length === 0 && (
                 <p className="text-xs text-muted-foreground pl-4">System idling. Waiting for activity...</p>
               )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <Link href="/command-center/map" className="block">
          <Card className="rounded-md border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">View Resource Map</h3>
                  <p className="text-xs text-muted-foreground">Live geographic view of blood banks and donors</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/emergencies/new" className="block">
          <Card className="rounded-md border-border/50 hover:bg-muted/30 transition-colors cursor-pointer border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Create Emergency Request</h3>
                  <p className="text-xs text-muted-foreground">Instantly dispatch a new critical requirement</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
