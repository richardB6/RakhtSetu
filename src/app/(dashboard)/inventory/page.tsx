'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { BLOOD_GROUPS, COMPONENT_TYPES, COMPONENT_LABELS } from '@/lib/engine/compatibility';
import type { BloodGroup, ComponentType } from '@/types';

interface InventoryItem {
  _id: string;
  bloodGroup: BloodGroup;
  component: ComponentType;
  availableUnits: number;
  reservedUnits: number;
  totalUnits: number;
  status: 'AVAILABLE' | 'RESERVED' | 'UNAVAILABLE';
  operationallyUnavailable: boolean;
  lastUpdated: string;
}

interface InventoryHistoryEntry {
  _id: string;
  action: string;
  reason?: string;
  createdAt: string;
  newState?: { availableUnits?: number; reservedUnits?: number; status?: string };
}

interface ActiveReservation {
  _id: string;
  matchId: string;
  emergencyRequestId: { requestId: string; bloodGroup: string; component: string };
  units: number;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [filterComponent, setFilterComponent] = useState<string>('all');
  const [operationalStatus, setOperationalStatus] = useState('OPEN');
  const [statusSaving, setStatusSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reservations, setReservations] = useState<ActiveReservation[]>([]);
  const [matchId, setMatchId] = useState('');
  const [reservationSaving, setReservationSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.data || []);
      }
      const statusRes = await fetch('/api/blood-bank/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setOperationalStatus(statusData.data?.operationalStatus || 'OPEN');
      }
      const reservationRes = await fetch('/api/inventory/reservations');
      if (reservationRes.ok) setReservations((await reservationRes.json()).data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOperationalStatus = async (value: string) => {
    setStatusSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/blood-bank/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update operational status');
      setOperationalStatus(value);
      setMessage('Operational status updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update operational status');
    } finally {
      setStatusSaving(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/inventory?history=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to load inventory history');
      setHistory(data.data || []);
      setShowHistory(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load inventory history');
    }
  };

  const reserveMatch = async () => {
    if (!matchId || !window.confirm('Reserve the accepted match inventory now?')) return;
    setReservationSaving(true);
    try {
      const response = await fetch('/api/inventory/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to reserve match');
      setMessage('Reservation created.');
      setMatchId('');
      await fetchInventory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reserve match');
    } finally {
      setReservationSaving(false);
    }
  };

  const releaseReservation = async (reservation: ActiveReservation) => {
    if (!window.confirm(`Release reservation for ${reservation.emergencyRequestId.requestId}?`)) return;
    try {
      const response = await fetch('/api/inventory/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId: reservation._id, reason: 'EXPLICIT_RELEASE' }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to release reservation');
      setMessage('Reservation released.');
      await fetchInventory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to release reservation');
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleUpdate = async (item: InventoryItem) => {
    const newUnits = editValues[item._id];
    if (newUnits === undefined || newUnits === item.availableUnits) return;

    setSaving(item._id);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroup: item.bloodGroup,
          component: item.component,
          availableUnits: newUnits,
        }),
      });
      if (res.ok) {
        await fetchInventory();
        const updated = { ...editValues };
        delete updated[item._id];
        setEditValues(updated);
      }
    } catch (err) {
      console.error('Failed to update inventory:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggleAvailability = async (item: InventoryItem) => {
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloodGroup: item.bloodGroup, component: item.component, availableUnits: item.availableUnits, operationallyUnavailable: !item.operationallyUnavailable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to update inventory status');
      setMessage(item.operationallyUnavailable ? 'Inventory restored.' : 'Inventory marked unavailable.');
      await fetchInventory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update inventory status');
    }
  };

  const filtered = filterComponent === 'all'
    ? inventory
    : inventory.filter((i) => i.component === filterComponent);

  const groupedByBloodGroup = BLOOD_GROUPS.reduce((acc, bg) => {
    acc[bg] = filtered.filter((i) => i.bloodGroup === bg);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const totalAvailable = filtered.reduce((sum, i) => sum + i.availableUnits, 0);
  const totalReserved = filtered.reduce((sum, i) => sum + i.reservedUnits, 0);
  const lowStockCount = filtered.filter((i) => i.availableUnits <= 2).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Blood Bank Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage blood component availability and stock levels
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'BLOOD_BANK' && <Select value={operationalStatus} onValueChange={(value) => value && updateOperationalStatus(value)} disabled={statusSaving}><SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Operational status" /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="LIMITED">Limited</SelectItem><SelectItem value="UNAVAILABLE">Unavailable</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent></Select>}
          <Select value={filterComponent} onValueChange={(value) => setFilterComponent(value ?? '')}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue placeholder="Filter by component" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Components</SelectItem>
              {COMPONENT_TYPES.map((ct) => (
                <SelectItem key={ct} value={ct}>{COMPONENT_LABELS[ct]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchInventory}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHistory}>History</Button>
        </div>
      </div>
      {error && <Card className="border-destructive/30 p-4 text-sm text-destructive">{error}</Card>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {showHistory && <Card className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Inventory history</h2><Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>Close</Button></div>{history.length === 0 ? <p className="text-sm text-muted-foreground">No inventory history found.</p> : <div className="space-y-2">{history.slice(0, 20).map((entry) => <div key={entry._id} className="flex items-center justify-between border-b border-border pb-2 text-xs"><span>{entry.action.replace(/_/g, ' ')}</span><span className="text-muted-foreground">{entry.newState?.availableUnits ?? '-'} available / {entry.newState?.reservedUnits ?? '-'} reserved</span></div>)}</div>}</Card>}
      {user?.role === 'BLOOD_BANK' && <Card className="space-y-3 p-4"><p className="text-sm font-semibold">Reservation actions</p><div className="flex gap-2"><Input placeholder="Accepted match ID" value={matchId} onChange={(event) => setMatchId(event.target.value)} /><Button onClick={reserveMatch} disabled={reservationSaving || !matchId}>Reserve</Button></div>{reservations.length === 0 ? <p className="text-xs text-muted-foreground">No active reservations.</p> : reservations.map((reservation) => <div key={reservation._id} className="flex items-center justify-between border-t border-border pt-2 text-xs"><span>{reservation.emergencyRequestId.requestId} · {reservation.units} units</span><Button size="sm" variant="outline" onClick={() => releaseReservation(reservation)}>Release</Button></div>)}</Card>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Available</p>
          <p className="text-2xl font-bold mt-1">{totalAvailable}</p>
          <p className="text-xs text-muted-foreground">units</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Reserved</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{totalReserved}</p>
          <p className="text-xs text-muted-foreground">units</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Stock</p>
          <p className="text-2xl font-bold mt-1">{totalAvailable + totalReserved}</p>
          <p className="text-xs text-muted-foreground">units</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Low Stock Items</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{lowStockCount}</p>
          <p className="text-xs text-muted-foreground">items</p>
        </Card>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {BLOOD_GROUPS.map((bg) => {
          const items = groupedByBloodGroup[bg] || [];
          if (items.length === 0 && filterComponent !== 'all') return null;

          return (
            <Card key={bg} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-base font-bold px-3 py-1">
                  {bg}
                </Badge>
                {items.some((i) => i.availableUnits <= 2) && (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="space-y-2">
                {items.length > 0 ? items.map((item) => (
                  <div key={item._id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {COMPONENT_LABELS[item.component] || item.component}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {user?.role === 'BLOOD_BANK' ? (
                          <Input
                            type="number"
                            min={0}
                            value={editValues[item._id] ?? item.availableUnits}
                            onChange={(e) =>
                              setEditValues({ ...editValues, [item._id]: parseInt(e.target.value) || 0 })
                            }
                            className="h-7 w-16 text-xs"
                          />
                        ) : (
                          <span className="text-sm font-bold">{item.availableUnits}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">avail</span>
                        <Badge variant={item.status === 'UNAVAILABLE' ? 'destructive' : 'outline'} className="text-[10px]">{item.status}</Badge>
                        {item.reservedUnits > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.reservedUnits} rsv
                          </Badge>
                        )}
                      </div>
                    </div>
                    {user?.role === 'BLOOD_BANK' && editValues[item._id] !== undefined && editValues[item._id] !== item.availableUnits && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleUpdate(item)}
                        disabled={saving === item._id}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {user?.role === 'BLOOD_BANK' && <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toggleAvailability(item)}>{item.operationallyUnavailable ? 'Restore' : 'Disable'}</Button>}
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground py-2">No inventory records</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
