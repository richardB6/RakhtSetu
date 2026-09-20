'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MapPin, Phone, Droplets, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { BLOOD_GROUPS } from '@/lib/engine/compatibility';
import type { BloodGroup } from '@/types';

interface DonorEntry {
  _id: string;
  userId?: { name: string; email: string; phone: string };
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  availabilityRadius: number;
  city: string;
  state: string;
  lastDonationDate?: string;
  totalDonations: number;
  gender?: string;
  emergencyNotificationsEnabled: boolean;
}

export default function DonorsPage() {
  const [donors, setDonors] = useState<DonorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBloodGroup, setFilterBloodGroup] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  const fetchDonors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterBloodGroup !== 'all') params.set('bloodGroup', filterBloodGroup);
      if (filterAvailability !== 'all') params.set('isAvailable', filterAvailability);
      const res = await fetch(`/api/resources/nearby?lat=19.076&lng=72.8777&radiusKm=100`);
      if (res.ok) {
        const data = await res.json();
        setDonors(data.data?.donors || []);
      }
    } catch (err) {
      console.error('Failed to fetch donors:', err);
    } finally {
      setLoading(false);
    }
  }, [filterBloodGroup, filterAvailability]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  const filtered = donors.filter((d) => {
    if (filterBloodGroup !== 'all' && d.bloodGroup !== filterBloodGroup) return false;
    if (filterAvailability === 'available' && !d.isAvailable) return false;
    if (filterAvailability === 'unavailable' && d.isAvailable) return false;
    return true;
  });

  const availableCount = donors.filter((d) => d.isAvailable).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Donor Network
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {donors.length} registered donors · {availableCount} currently available
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterBloodGroup} onValueChange={setFilterBloodGroup}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue placeholder="Blood group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {BLOOD_GROUPS.map((bg) => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAvailability} onValueChange={setFilterAvailability}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Blood Group Summary */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {BLOOD_GROUPS.map((bg) => {
          const count = donors.filter((d) => d.bloodGroup === bg && d.isAvailable).length;
          const total = donors.filter((d) => d.bloodGroup === bg).length;
          return (
            <Card
              key={bg}
              className={`p-3 text-center cursor-pointer transition-colors ${
                filterBloodGroup === bg ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
              }`}
              onClick={() => setFilterBloodGroup(filterBloodGroup === bg ? 'all' : bg)}
            >
              <p className="text-lg font-bold">{bg}</p>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-400">{count}</span>/{total}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Donor List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No donors found matching the criteria</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((donor) => (
            <Card key={donor._id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <Droplets className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{donor.userId?.name || 'Anonymous Donor'}</p>
                    <p className="text-xs text-muted-foreground">{donor.city}, {donor.state}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-base font-bold px-2">
                  {donor.bloodGroup}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>Radius: {donor.availabilityRadius} km</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Donations: {donor.totalDonations}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex h-2 w-2 rounded-full ${donor.isAvailable ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                  <span className={donor.isAvailable ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {donor.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                  {donor.emergencyNotificationsEnabled && (
                    <Badge variant="secondary" className="text-[9px] ml-auto">Emergency Alerts ON</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
