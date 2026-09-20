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
  lastUpdated: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [filterComponent, setFilterComponent] = useState<string>('all');

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
          <Select value={filterComponent} onValueChange={setFilterComponent}>
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
        </div>
      </div>

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
