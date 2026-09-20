'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Heart, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AvailabilityStatus = 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE' | 'UNAVAILABLE';
type DonorAvailability = {
  availabilityStatus: AvailabilityStatus;
  availabilityRadius: number;
  emergencyNotificationsEnabled: boolean;
  verificationStatus?: string;
};

export default function DonorAvailabilityPage() {
  const [data, setData] = useState<DonorAvailability | null>(null);
  const [status, setStatus] = useState<AvailabilityStatus>('UNAVAILABLE');
  const [radius, setRadius] = useState('10');
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/donor/availability');
      if (!response.ok) throw new Error('Unable to load availability');
      const payload = await response.json();
      const donor = payload.data as DonorAvailability;
      setData(donor);
      setStatus(donor.availabilityStatus);
      setRadius(String(donor.availabilityRadius));
      setNotifications(donor.emergencyNotificationsEnabled);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load availability' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/donor/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: status, availabilityRadius: Number(radius), emergencyNotificationsEnabled: notifications }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to save availability');
      setData(payload.data);
      setMessage({ type: 'success', text: 'Availability settings saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save availability' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading availability...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Heart className="h-5 w-5 text-primary" /> Donor Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational availability is separate from medical eligibility.</p>
      </div>
      {message && <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${message.type === 'success' ? 'border-emerald-500/30 text-emerald-400' : 'border-destructive/30 text-destructive'}`}>{message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{message.text}</div>}
      <Card className="space-y-5 p-5">
        <div className="flex items-center justify-between"><span className="text-sm font-medium">Verification status</span><Badge variant="outline">{data?.verificationStatus || 'PENDING'}</Badge></div>
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Current status</p><p className="text-xs text-muted-foreground">Controls whether new emergency requests can reach you.</p></div><Badge variant={data?.availabilityStatus === 'AVAILABLE' ? 'default' : 'secondary'}>{data?.availabilityStatus || 'UNKNOWN'}</Badge></div>
        <div className="space-y-2"><label className="text-sm font-medium">Availability</label><Select value={status} onValueChange={(value) => setStatus(value as AvailabilityStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AVAILABLE">Available</SelectItem><SelectItem value="TEMPORARILY_UNAVAILABLE">Temporarily unavailable</SelectItem><SelectItem value="UNAVAILABLE">Unavailable</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><label className="text-sm font-medium">Service radius (km)</label><Input type="number" min={1} max={200} value={radius} onChange={(event) => setRadius(event.target.value)} /></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} /> Receive emergency notifications</label>
        <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save settings'}</Button>
      </Card>
    </div>
  );
}