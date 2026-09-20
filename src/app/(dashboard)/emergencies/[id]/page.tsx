'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Droplets, 
  User, 
  Building2,
  ChevronLeft,
  Activity,
  AlertTriangle,
  Play,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IEmergencyRequest, IMatch } from '@/types';
import { formatTime, formatDate, elapsedTime } from '@/lib/utils/date';
import { SEVERITY_CONFIG, COMPONENT_LABELS } from '@/lib/engine/compatibility';

export default function EmergencyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [emergency, setEmergency] = useState<IEmergencyRequest | null>(null);
  const [matches, setMatches] = useState<IMatch[]>([]);
  const [timeline, setTimeline] = useState<Array<{ _id: string; action: string; description: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmergency = async () => {
    try {
      const res = await fetch(`/api/emergencies/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEmergency(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch emergency:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch(`/api/emergencies/${id}/matches`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMatches(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const fetchTimeline = async () => {
    const res = await fetch(`/api/emergencies/${id}/timeline`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) setTimeline(data.data);
    }
  };

  useEffect(() => {
    fetchEmergency();
    fetchMatches();
    fetchTimeline();
    setLoading(false);

    const interval = setInterval(() => {
      fetchEmergency();
      fetchMatches();
      fetchTimeline();
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  const handleRunMatching = () => {
    router.push(`/emergencies/${id}/matching`);
  };

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/emergencies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, cancellationReason: status === 'CANCELLED' ? 'Cancelled by hospital operator' : undefined }),
    });
    if (res.ok) {
      await fetchEmergency();
      await fetchTimeline();
    }
  };

  const handleMatchAction = async (matchId: string, action: 'accept' | 'decline') => {
    try {
      await fetch(`/api/matches/${matchId}/${action}`, { method: 'POST' });
      fetchMatches();
    } catch (error) {
      console.error(`Failed to ${action} match:`, error);
    }
  };

  if (loading || !emergency) {
    return <div className="flex items-center justify-center h-full min-h-[50vh]"><Activity className="animate-spin w-8 h-8" /></div>;
  }

  const severityConfig = SEVERITY_CONFIG[emergency.severity];
  
  const canRunMatching = (user?.role === 'HOSPITAL' || user?.role === 'ADMIN') && 
    (emergency.status === 'CREATED' || emergency.status === 'MATCHING' || emergency.status === 'RESOURCES_NOTIFIED');

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const timelineEvents = [
    { label: 'Request Created', time: emergency.createdAt, completed: true },
    { label: 'Matching Started', time: emergency.matchingStartedAt, completed: !!emergency.matchingStartedAt },
    { label: 'Resources Notified', time: emergency.status === 'RESOURCES_NOTIFIED' || emergency.status === 'RESPONSES_RECEIVED' || emergency.status === 'RESOURCE_SELECTED' || emergency.status === 'RESERVED' || emergency.status === 'IN_TRANSIT' || emergency.status === 'FULFILLED' ? new Date() : null, completed: ['RESOURCES_NOTIFIED', 'RESPONSES_RECEIVED', 'RESOURCE_SELECTED', 'RESERVED', 'IN_TRANSIT', 'FULFILLED'].includes(emergency.status) },
    { label: 'First Response', time: emergency.firstResponseAt, completed: !!emergency.firstResponseAt },
    { label: emergency.status === 'CANCELLED' ? 'Cancelled' : 'Fulfilled', time: emergency.fulfilledAt || emergency.cancelledAt, completed: !!(emergency.fulfilledAt || emergency.cancelledAt) }
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/emergencies')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold tracking-tight">{emergency.requestId}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-zinc-400">Elapsed: {elapsedTime(emergency.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={`bg-${severityConfig.color}-500/10 text-${severityConfig.color}-500 hover:bg-${severityConfig.color}-500/20 border-${severityConfig.color}-500/20`}>
            {severityConfig.label.toUpperCase()} PRIORITY
          </Badge>
          <Badge variant="outline" className="uppercase">{emergency.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column - 40% (4/10) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/20">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-zinc-400" />
                Request Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="col-span-2 flex justify-between items-start bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-400">Blood Group</p>
                    <div className="text-4xl font-bold text-red-500 mt-1">{emergency.bloodGroup}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-400">Quantity</p>
                    <div className="text-2xl font-bold">{emergency.quantityFulfilled} / {emergency.quantity}</div>
                    <p className="text-xs text-zinc-500">Units Required</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-zinc-400 flex items-center gap-1.5"><Droplets className="w-4 h-4"/> Component</p>
                  <p className="font-medium mt-1">{COMPONENT_LABELS[emergency.component] || emergency.component}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 flex items-center gap-1.5"><User className="w-4 h-4"/> Patient Ref</p>
                  <p className="font-medium mt-1">{emergency.patientReference}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Required By</p>
                  <p className="font-medium mt-1">{formatTime(emergency.requiredBy)} {formatDate(emergency.requiredBy)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Severity</p>
                  <p className="font-medium mt-1">{severityConfig.label}</p>
                </div>
                
                <div className="col-span-2 pt-4 border-t border-zinc-800/50">
                  <p className="text-sm text-zinc-400 flex items-center gap-1.5 mb-1"><Building2 className="w-4 h-4"/> Facility & Contact</p>
                  <p className="font-medium">{emergency.hospital?.name || 'Hospital'}</p>
                  <p className="text-sm text-zinc-300 mt-0.5">{emergency.contactPerson} • {emergency.contactPhone}</p>
                  <p className="text-sm text-zinc-400 mt-1 flex items-start gap-1"><MapPin className="w-4 h-4 shrink-0 mt-0.5"/> {emergency.address}, {emergency.city}</p>
                  <Link href={`/map?emergencyId=${encodeURIComponent(emergency._id)}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300">
                    <MapPin className="h-4 w-4" /> View nearby resources
                  </Link>
                </div>

                {emergency.notes && (
                  <div className="col-span-2 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/50 text-sm">
                    <span className="font-medium text-zinc-300">Notes:</span> <span className="text-zinc-400">{emergency.notes}</span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
              {canRunMatching && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleRunMatching}>
                  <Play className="w-4 h-4 mr-2" />
                  Run Matching Engine
                </Button>
              )}
              <div className="flex gap-3 w-full">
                {(user?.role === 'HOSPITAL' || user?.role === 'ADMIN') && emergency.status !== 'CANCELLED' && emergency.status !== 'FULFILLED' && (
                  <Button onClick={() => updateStatus('CANCELLED')} variant="outline" className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/20">
                    Cancel Request
                  </Button>
                )}
                {(user?.role === 'HOSPITAL' || user?.role === 'ADMIN') && ['RESOURCE_SELECTED', 'RESERVED', 'PROCESSING', 'IN_TRANSIT'].includes(emergency.status) && (
                  <Button onClick={() => updateStatus('FULFILLED')} variant="outline" className="w-full text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20">
                    Mark Fulfilled
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader><CardTitle className="text-lg">REQUEST TIMELINE</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {timeline.map((event) => (
                <div key={event._id} className="border-l-2 border-red-500/40 pl-3">
                  <p className="text-sm font-medium">{event.description}</p>
                  <p className="text-xs text-zinc-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Center Column - 30% (3/10) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="bg-zinc-950 border-zinc-800 h-full flex flex-col">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/20 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">MATCHED RESOURCES</CardTitle>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">{matches.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-y-auto max-h-[800px] p-4 flex flex-col gap-4">
              <AnimatePresence>
                {matches.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-8 text-zinc-500 bg-zinc-900/30 rounded-lg border border-zinc-800 border-dashed">
                    <p>No matches found.</p>
                    {canRunMatching && <p className="text-sm mt-2">Run matching engine to find compatible resources.</p>}
                  </motion.div>
                ) : (
                  matches.map((match, i) => (
                    <motion.div 
                      key={match._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800" />
                        <CardContent className="p-4 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs text-zinc-400">#{match.rank}</Badge>
                              <span className="font-medium text-sm">{match.resourceType === 'BLOOD_BANK' ? match.bloodBank?.name || 'Blood Bank' : match.donor?.userId || 'Donor'}</span>
                            </div>
                            <div className={`text-2xl font-bold font-mono ${getScoreColor(match.score)}`}>
                              {match.score}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-[10px] uppercase bg-zinc-800/50">{match.resourceType.replace('_', ' ')}</Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase bg-zinc-800/50">{match.compatibilityType.replace('_', ' ')}</Badge>
                            <Badge variant={match.isVerified ? 'default' : 'outline'} className={match.isVerified ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]' : 'text-[10px]'}>
                              {match.isVerified ? 'VERIFIED' : 'PENDING'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mt-1">
                            <div className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {match.distanceKm.toFixed(1)} km</div>
                            <div className="flex items-center gap-1"><Droplets className="w-3 h-3"/> {match.availableQuantity} Units</div>
                          </div>
                          
                          <div className="text-xs text-zinc-500 space-y-1 mt-1 border-t border-zinc-800/50 pt-2">
                            {match.reasons.map((r, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 mt-0.5 text-zinc-600 shrink-0"/>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center mt-2 pt-3 border-t border-zinc-800">
                            <Badge variant="outline" className={`text-[10px] ${match.status === 'ACCEPTED' ? 'text-emerald-500 border-emerald-500/20' : match.status === 'DECLINED' ? 'text-red-500 border-red-500/20' : 'text-amber-500 border-amber-500/20'}`}>
                              {match.status}
                            </Badge>

                            {user?.role && ['BLOOD_BANK', 'DONOR'].includes(user.role) && match.resourceUserId === user._id && ['NOTIFIED', 'PENDING'].includes(match.status) && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700 hover:bg-zinc-800" onClick={() => handleMatchAction(match._id, 'decline')}>
                                  Decline
                                </Button>
                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleMatchAction(match._id, 'accept')}>
                                  Accept
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 30% (3/10) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-400" />
                REQUEST TIMELINE
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 relative">
              <div className="absolute left-8 top-8 bottom-8 w-px bg-zinc-800" />
              <div className="space-y-8 relative">
                {timelineEvents.map((evt, i) => (
                  <div key={i} className={`flex gap-4 items-start ${!evt.completed && evt.time == null ? 'opacity-40' : ''}`}>
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-zinc-950 ${
                      evt.completed ? 'border-emerald-500 text-emerald-500' : 
                      evt.time ? 'border-blue-500 text-blue-500' : 
                      'border-zinc-700 text-zinc-600'
                    }`}>
                      {evt.completed ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-medium ${evt.completed ? 'text-zinc-200' : 'text-zinc-400'}`}>{evt.label}</p>
                      {evt.time && (
                        <p className="text-xs text-zinc-500 mt-1 font-mono">
                          {formatTime(evt.time)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {user?.role === 'ADMIN' && (
            <Card className="bg-zinc-950 border-zinc-800 border-dashed border-red-900/50 bg-red-950/10">
              <CardContent className="p-4 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-medium text-red-500 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> Escalation Controls</h3>
                  <p className="text-xs text-zinc-400">Current Search Radius: <span className="font-mono text-zinc-300">{emergency.searchRadiusKm} km</span></p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="w-full border-red-900/50 hover:bg-red-900/20 text-red-400 text-xs">
                    Expand Radius (+5km)
                  </Button>
                  <Button variant="destructive" size="sm" className="w-full text-xs">
                    Escalate Priority
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
