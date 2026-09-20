'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Navigation, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';

type Resource = {
  id: string; type: 'BLOOD_BANK' | 'DONOR'; name: string; bloodGroup?: string; component?: string;
  lat: number; lng: number; address?: string; city?: string; operatingHours?: string;
  availability: string; availableQuantity: number; distanceKm: number; isVerified: boolean;
  verificationLabel: string; score: number; inventory?: Array<{ bloodGroup: string; component: string; availableUnits: number }>;
};
type Center = { lat: number; lng: number };
const DEFAULT_CENTER: Center = { lat: 19.076, lng: 72.8777 };
const RADII = [10, 25, 50, 100];

const markerIcon = (type: Resource['type'], selected: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:${type === 'BLOOD_BANK' ? '#dc2626' : '#2563eb'};border:3px solid white;box-shadow:0 2px 8px #0008;color:white;font-weight:800;font-size:11px;transform:scale(${selected ? 1.18 : 1})">${type === 'BLOOD_BANK' ? 'BB' : '🩸'}</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
});

function Recenter({ center }: { center: Center }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng]); }, [center, map]);
  return null;
}

export default function ResourceMap({ emergencyId }: { emergencyId?: string }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [resources, setResources] = useState<Resource[]>([]);
  const [radius, setRadius] = useState(10);
  const [bloodGroup, setBloodGroup] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [meta, setMeta] = useState<{ radiusState?: string; nextRadiusKm?: number | null; availableCount?: number } | null>(null);

  const loadResources = useCallback(async (position = center, nextRadius = radius) => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ lat: String(position.lat), lng: String(position.lng), radiusKm: String(nextRadius) });
      if (emergencyId) query.set('emergencyId', emergencyId);
      if (bloodGroup !== 'ALL') query.set('bloodGroup', bloodGroup);
      const response = await fetch(`/api/resources/nearby?${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load resources');
      setResources(result.data); setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load resources');
    } finally { setLoading(false); }
  }, [bloodGroup, center, radius, emergencyId]);

  useEffect(() => { void loadResources(); }, [loadResources]);

  useEffect(() => {
    if (!emergencyId) return;
    fetch(`/api/emergencies/${emergencyId}`)
      .then((response) => response.json())
      .then((result) => {
        const coordinates = result?.data?.location?.coordinates;
        if (result?.success && Array.isArray(coordinates) && coordinates.length === 2) {
          const next = { lat: Number(coordinates[1]), lng: Number(coordinates[0]) };
          setCenter(next);
        }
      })
      .catch(() => setError('Unable to load the emergency location. Showing fallback location.'));
  }, [emergencyId]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not supported. Showing Mumbai fallback.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const next = { lat: coords.latitude, lng: coords.longitude }; setCenter(next); setLocating(false); void loadResources(next, radius); },
      () => { setError('Location permission was unavailable. Showing Mumbai fallback.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  const expand = () => {
    const next = meta?.nextRadiusKm;
    if (next) { setRadius(next); void loadResources(center, next); }
  };
  const visible = useMemo(() => resources.filter((resource) => bloodGroup === 'ALL' || resource.bloodGroup === bloodGroup || resource.type === 'BLOOD_BANK'), [bloodGroup, resources]);

  return (
    <div className="flex h-full min-h-[620px] flex-col gap-4 text-foreground">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-red-500" /><h1 className="text-xl font-bold">Live resource map</h1></div><p className="mt-1 text-xs text-muted-foreground">Verified availability near your emergency location · OpenStreetMap</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="ALL">All blood groups</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((group) => <option key={group}>{group}</option>)}</select>
          <select value={radius} onChange={(event) => { const next = Number(event.target.value); setRadius(next); void loadResources(center, next); }} className="rounded-md border bg-background px-3 py-2 text-sm">{RADII.map((value) => <option key={value} value={value}>{value} km radius</option>)}</select>
          <button onClick={locate} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">{locating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Use my location</button>
        </div>
      </div>
      {error && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700">{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-border bg-muted">
          <MapContainer center={[center.lat, center.lng]} zoom={11} style={{ height: '100%', minHeight: 420, width: '100%' }} scrollWheelZoom>
            <Recenter center={center} />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={[center.lat, center.lng]} radius={radius * 1000} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.06, weight: 2 }} />
            <Marker position={[center.lat, center.lng]} icon={L.divIcon({ className: '', html: '<div style="width:18px;height:18px;border-radius:50%;background:#111827;border:4px solid white;box-shadow:0 0 0 8px #11182733"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })}><Popup>Emergency location</Popup></Marker>
            {visible.map((resource) => <Marker key={resource.id} position={[resource.lat, resource.lng]} icon={markerIcon(resource.type, selected?.id === resource.id)} eventHandlers={{ click: () => setSelected(resource) }}><Popup><strong>{resource.name}</strong><br />{resource.distanceKm} km · {resource.availability.toLowerCase()}</Popup></Marker>)}
          </MapContainer>
          <div className="absolute left-3 top-3 z-[1000] rounded-md bg-card/95 px-3 py-2 text-xs shadow"><span className="font-semibold">{visible.length}</span> resources · {meta?.availableCount || 0} available</div>
        </div>
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Nearby resources</h2><p className="text-xs text-muted-foreground">{meta?.radiusState === 'EXPAND_AVAILABLE' ? `No results yet · expand to ${meta.nextRadiusKm} km` : `Sorted by score and distance`}</p></div><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /></div>
          {meta?.radiusState === 'EXPAND_AVAILABLE' && <button onClick={expand} className="m-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700">Expand search to {meta.nextRadiusKm} km <span className="float-right font-bold">→</span></button>}
          <div className="flex-1 overflow-y-auto p-3">{loading ? <div className="p-4 text-sm text-muted-foreground">Locating compatible resources…</div> : visible.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No resources found in this radius. Try expanding the search.</div> : visible.map((resource) => <button key={resource.id} onClick={() => setSelected(resource)} className={`mb-2 w-full rounded-lg border p-3 text-left transition hover:border-red-300 ${selected?.id === resource.id ? 'border-red-500 bg-red-50/50' : 'border-border'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{resource.name}</p><p className="text-xs text-muted-foreground">{resource.type === 'BLOOD_BANK' ? 'Blood bank' : `${resource.bloodGroup} donor`} · {resource.distanceKm} km</p></div><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">{resource.score}</span></div><div className="mt-2 flex items-center gap-2 text-xs"><span className={resource.availability === 'AVAILABLE' ? 'text-emerald-700' : 'text-muted-foreground'}>{resource.availableQuantity} unit{resource.availableQuantity === 1 ? '' : 's'} available</span>{resource.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />}</div></button>)}</div>
          {selected && <div className="border-t bg-muted/30 p-4 text-sm"><div className="mb-2 flex items-center justify-between"><strong>{selected.name}</strong><button onClick={() => setSelected(null)} className="text-xs text-muted-foreground">Close</button></div><p className="text-xs text-muted-foreground">{selected.address || selected.city}</p><p className="mt-2 flex items-center gap-1 text-xs"><ShieldCheck className="h-3.5 w-3.5 text-blue-600" />{selected.verificationLabel}</p><p className="mt-1 text-xs">{selected.operatingHours || 'Available for emergency response'} · score {selected.score}/100</p><a className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700" href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}`} target="_blank" rel="noreferrer"><Navigation className="h-3.5 w-3.5" />Open directions</a></div>}
        </aside>
      </div>
    </div>
  );
}
