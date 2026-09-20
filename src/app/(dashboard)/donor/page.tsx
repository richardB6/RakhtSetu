'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, Droplets, Heart, MapPin, Navigation, ShieldCheck, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { COMPONENT_LABELS } from '@/lib/engine/compatibility';
import { timeAgo } from '@/lib/utils/date';

type DashboardData = {
  profile: { bloodGroup: string; city: string; state: string; totalDonations: number; lastDonationDate?: string | null; user?: { name: string; verificationStatus: string } };
  availability: { status: string; radiusKm: number; emergencyNotificationsEnabled: boolean; verificationStatus: string };
  requests: Array<{ _id: string; requestId: string; bloodGroup: string; component: string; quantity: number; severity: string; status: string; requiredBy: string; city: string; createdAt: string }>;
  matches: Array<{ _id: string; status: string; score: number; distanceKm: number; availableQuantity: number; emergencyRequestId?: { requestId: string; bloodGroup: string; component: string; quantity: number; severity: string; status: string } }>;
  nearbyBanks: Array<{ _id: string; name: string; city: string; state: string; address: string; operatingHours: string; operationalStatus: string; distanceKm: number; location: { coordinates: number[] } }>;
  donationHistory: { totalDonations: number; lastDonationDate: string | null };
  notifications: Array<{ _id: string; title: string; message: string; severity: string; createdAt: string; isRead: boolean }>;
};

export default function DonorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState('UNAVAILABLE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/donor/dashboard');
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Unable to load donor dashboard');
      setData(payload.data);
      setStatus(payload.data.availability.status);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load donor dashboard');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveAvailability = async (nextStatus: string) => {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/donor/availability', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ availabilityStatus: nextStatus }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update availability');
      setStatus(nextStatus); setMessage('Availability updated.');
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to update availability');
    } finally { setSaving(false); }
  };

  const respond = async (matchId: string, accept: boolean) => {
    setActionId(matchId); setMessage(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to respond to request');
      setMessage(accept ? 'Emergency response accepted.' : 'Emergency response declined.');
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to respond to request'); }
    finally { setActionId(null); }
  };

  const availabilityTone = status === 'AVAILABLE' ? 'border-emerald-400/50 bg-emerald-400/10' : status === 'TEMPORARILY_UNAVAILABLE' ? 'border-amber-400/50 bg-amber-400/10' : 'border-border bg-card';

  return <div className="mx-auto max-w-[1400px] space-y-6">
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><div className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /><p className="ops-kicker">Donor portal</p></div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Good to see you, {user?.name?.split(' ')[0] || 'Donor'}</h1><p className="mt-1 text-sm text-muted-foreground">Your emergency response profile, requests, and local resources.</p></div><div className="flex gap-2"><Link href="/notifications"><Button variant="outline" size="sm"><Bell className="mr-2 h-4 w-4" />Notifications</Button></Link><Link href="/profile"><Button variant="outline" size="sm"><UserRound className="mr-2 h-4 w-4" />Profile</Button></Link></div></header>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
    {message && <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"><CheckCircle2 className="mr-2 inline h-4 w-4" />{message}</div>}

    <section className={`ops-panel rounded-md border p-5 ${availabilityTone}`}><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="ops-kicker">Operational availability</p><div className="mt-2 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${status === 'AVAILABLE' ? 'bg-emerald-400 animate-dot-pulse' : status === 'TEMPORARILY_UNAVAILABLE' ? 'bg-amber-400' : 'bg-muted-foreground'}`} /><h2 className="text-2xl font-semibold">{status.replace(/_/g, ' ')}</h2></div><p className="mt-1 text-sm text-muted-foreground">Availability is operational only and does not determine medical eligibility.</p></div><div className="grid grid-cols-3 gap-2"><Button size="lg" variant={status === 'AVAILABLE' ? 'default' : 'outline'} disabled={saving} onClick={() => saveAvailability('AVAILABLE')}>Available</Button><Button size="lg" variant={status === 'UNAVAILABLE' ? 'secondary' : 'outline'} disabled={saving} onClick={() => saveAvailability('UNAVAILABLE')}>Unavailable</Button><Button size="lg" variant={status === 'TEMPORARILY_UNAVAILABLE' ? 'secondary' : 'outline'} disabled={saving} onClick={() => saveAvailability('TEMPORARILY_UNAVAILABLE')}>Temporary</Button></div></div></section>

    <section className="grid gap-4 md:grid-cols-4"><Card className="ops-panel p-4"><p className="ops-kicker">Blood group</p><p className="mt-2 text-3xl font-semibold text-primary">{data?.profile.bloodGroup || '—'}</p></Card><Card className="ops-panel p-4"><p className="ops-kicker">Verification</p><p className="mt-2 text-lg font-semibold">{data?.availability.verificationStatus || 'PENDING'}</p></Card><Card className="ops-panel p-4"><p className="ops-kicker">Donations recorded</p><p className="mt-2 text-3xl font-semibold">{data?.donationHistory.totalDonations ?? 0}</p></Card><Card className="ops-panel p-4"><p className="ops-kicker">Emergency alerts</p><p className="mt-2 text-lg font-semibold">{data?.availability.emergencyNotificationsEnabled ? 'Enabled' : 'Disabled'}</p><Link className="mt-1 inline-block text-xs text-primary" href="/donor/availability">Manage preferences</Link></Card></section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]"><Card className="ops-panel overflow-hidden"><div className="border-b border-border/70 p-4"><h2 className="font-semibold">Emergency requests for you</h2><p className="text-xs text-muted-foreground">Requests where the matching engine identified your donor profile.</p></div><div className="divide-y divide-border/70">{!data?.matches.length ? <div className="p-8 text-center text-sm text-muted-foreground">No emergency requests currently require your response.</div> : data.matches.map((match) => <div key={match._id} className="p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Badge variant={match.emergencyRequestId?.severity === 'CRITICAL' ? 'destructive' : 'outline'}>{match.emergencyRequestId?.severity || 'REQUEST'}</Badge><span className="font-mono text-sm">{match.emergencyRequestId?.requestId || 'Emergency request'}</span></div><p className="mt-2 text-sm">{match.emergencyRequestId?.quantity} unit(s) · {match.emergencyRequestId?.bloodGroup} · {COMPONENT_LABELS[match.emergencyRequestId?.component as keyof typeof COMPONENT_LABELS] || match.emergencyRequestId?.component}</p><p className="mt-1 text-xs text-muted-foreground">{match.distanceKm.toFixed(1)} km away · operational score {match.score}</p></div><div className="flex items-center gap-2">{match.status === 'NOTIFIED' || match.status === 'PENDING' ? <><Button size="sm" variant="outline" disabled={actionId === match._id} onClick={() => respond(match._id, false)}>Decline</Button><Button size="sm" disabled={actionId === match._id} onClick={() => respond(match._id, true)}>Accept</Button></> : <Badge variant="secondary">{match.status}</Badge>}</div></div></div>)}</div></Card>
      <div className="space-y-6"><Card className="ops-panel p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Donation history</h2><p className="text-xs text-muted-foreground">Operational records on your donor profile.</p></div><Droplets className="h-5 w-5 text-primary" /></div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Total donations</span><strong>{data?.donationHistory.totalDonations ?? 0}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Last recorded donation</span><strong>{data?.donationHistory.lastDonationDate ? new Date(data.donationHistory.lastDonationDate).toLocaleDateString() : 'No record'}</strong></div></div></Card><Card className="ops-panel p-4"><h2 className="font-semibold">Recent notifications</h2><div className="mt-3 space-y-3">{!data?.notifications.length ? <p className="text-sm text-muted-foreground">No notifications.</p> : data.notifications.slice(0, 4).map((notification) => <Link key={notification._id} href="/notifications" className="block border-b border-border/60 pb-2 last:border-0"><p className="text-sm font-medium">{notification.title}</p><p className="text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</p></Link>)}</div></Card></div></section>

    <section><div className="mb-3 flex items-end justify-between"><div><h2 className="font-semibold">Nearby blood banks</h2><p className="text-xs text-muted-foreground">Verified operational facilities within your service radius.</p></div><Link href="/map" className="text-sm text-primary">Open map</Link></div>{!data?.nearbyBanks.length ? <Card className="ops-panel p-8 text-center text-sm text-muted-foreground">No verified blood banks found within your current radius.</Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.nearbyBanks.map((bank) => <Card key={bank._id} className="ops-panel p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{bank.name}</p><p className="mt-1 text-xs text-muted-foreground">{bank.city}, {bank.state}</p></div><ShieldCheck className="h-4 w-4 text-primary" /></div><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{bank.distanceKm} km</p><p className="mt-1 text-xs text-muted-foreground">{bank.operatingHours}</p><a className="mt-3 inline-flex items-center gap-1 text-xs text-primary" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${bank.location.coordinates[1]}&mlon=${bank.location.coordinates[0]}`}><Navigation className="h-3.5 w-3.5" />Directions</a></Card>)}</div>}</section>
  </div>;
}
