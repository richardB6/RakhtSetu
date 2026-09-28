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
  const [profileMissing, setProfileMissing] = useState(false);
  const [status, setStatus] = useState<AvailabilityStatus>('UNAVAILABLE');
  const [radius, setRadius] = useState('10');
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProfileMissing(false);
    try {
      const response = await fetch('/api/donor/availability');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load availability');
      }

      // API returns data: null if the donor profile hasn't been created yet
      const donor = payload.data as DonorAvailability | null;
      if (!donor) {
        setProfileMissing(true);
        return;
      }

      setData(donor);
      setStatus(donor.availabilityStatus ?? 'UNAVAILABLE');
      setRadius(String(donor.availabilityRadius ?? 10));
      setNotifications(donor.emergencyNotificationsEnabled ?? true);
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
        body: JSON.stringify({
          availabilityStatus: status,
          availabilityRadius: Number(radius),
          emergencyNotificationsEnabled: notifications,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to save availability');
      setData(payload.data);
      setMessage({ type: 'success', text: 'Availability settings saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save availability' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading availability settings...
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Heart className="h-5 w-5 text-primary" /> Donor Availability
          </h1>
        </div>
        <Card className="p-6 space-y-3 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="font-semibold">Donor profile not found</p>
          </div>
          <p className="text-sm text-amber-700">
            Your donor profile could not be found. This can happen if registration did not complete
            successfully. Please contact support or try logging out and registering again.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Heart className="h-5 w-5 text-primary" /> Donor Availability
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational availability is separate from medical eligibility. Setting yourself as
          available means you consent to be contacted for compatible requests.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <Card className="space-y-5 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Verification status</span>
          <Badge variant="outline">{data?.verificationStatus || 'PENDING'}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Persisted status</p>
            <p className="text-xs text-muted-foreground">Currently saved in the database.</p>
          </div>
          <Badge
            className={
              data?.availabilityStatus === 'AVAILABLE'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : data?.availabilityStatus === 'TEMPORARILY_UNAVAILABLE'
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
            }
          >
            {data?.availabilityStatus?.replace(/_/g, ' ') || 'UNKNOWN'}
          </Badge>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Change availability</label>
          <Select value={status} onValueChange={(value) => setStatus(value as AvailabilityStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Available — ready for emergency requests</SelectItem>
              <SelectItem value="TEMPORARILY_UNAVAILABLE">Temporarily unavailable</SelectItem>
              <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Service radius (km)</label>
          <p className="text-xs text-muted-foreground">
            Emergency requests within this radius may be routed to you.
          </p>
          <Input
            type="number"
            min={1}
            max={200}
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
            className="max-w-[120px]"
          />
        </div>

        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(event) => setNotifications(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span>Receive emergency notifications</span>
        </label>

        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </Card>
    </div>
  );
}