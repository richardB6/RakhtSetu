'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type BloodBankStatus = 'OPEN' | 'LIMITED' | 'UNAVAILABLE' | 'CLOSED';
type BloodBankRow = { _id: string; name: string; city: string; state: string; operationalStatus: BloodBankStatus; isOpen: boolean };

export default function BloodBankStatusPage() {
  const [banks, setBanks] = useState<BloodBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/blood-bank/status');
      if (!response.ok) throw new Error('Unable to load blood banks');
      setBanks((await response.json()).data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load blood banks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (bank: BloodBankRow, status: BloodBankStatus) => {
    setSaving(bank._id);
    setMessage(null);
    try {
      const response = await fetch(`/api/blood-bank/status?bloodBankId=${bank._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update status');
      setBanks((current) => current.map((item) => item._id === bank._id ? { ...item, operationalStatus: status, isOpen: status === 'OPEN' || status === 'LIMITED' } : item));
      setMessage(`${bank.name} status updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update status');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading blood banks...</div>;

  return <div className="space-y-6"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Building2 className="h-5 w-5 text-primary" /> Blood Bank Status</h1><p className="mt-1 text-sm text-muted-foreground">Manage operational availability for verified blood-bank resources.</p></div>{message && <p className="text-sm text-emerald-400">{message}</p>}{banks.length === 0 ? <Card className="p-12 text-center text-sm text-muted-foreground">No blood banks found.</Card> : <div className="space-y-3">{banks.map((bank) => <Card key={bank._id} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium">{bank.name}</p><p className="text-xs text-muted-foreground">{bank.city}, {bank.state}</p></div><div className="flex items-center gap-3"><Badge variant={bank.operationalStatus === 'OPEN' ? 'default' : 'secondary'}>{bank.operationalStatus}</Badge><Select value={bank.operationalStatus} onValueChange={(value) => save(bank, value as BloodBankStatus)} disabled={saving === bank._id}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="LIMITED">Limited</SelectItem><SelectItem value="UNAVAILABLE">Unavailable</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent></Select><Button size="sm" variant="ghost" disabled={saving === bank._id} onClick={() => save(bank, bank.operationalStatus)}><Save className="h-4 w-4" /></Button></div></Card>)}</div>}</div>;
}