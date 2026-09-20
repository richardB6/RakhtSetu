'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BloodGroup } from '@/lib/engine/compatibility';

// Fix for default marker icons in leaflet with nextjs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// Custom icons using divIcon
const createCustomIcon = (type: 'bb' | 'donor' | 'emergency', text: string) => {
  let bgColor = 'bg-blue-500';
  let pulse = '';
  
  if (type === 'bb') bgColor = 'bg-red-500';
  if (type === 'emergency') {
    bgColor = 'bg-orange-500';
    pulse = 'animate-pulse';
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${bgColor} ${pulse} text-white text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full border-2 border-white shadow-lg shadow-black/50">
             ${text}
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const bloodBankIcon = createCustomIcon('bb', 'BB');
const donorIcon = (bg: string) => createCustomIcon('donor', bg);
const emergencyIcon = createCustomIcon('emergency', '!');

export default function ResourceMap() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BloodGroup | 'ALL'>('ALL');

  const center: [number, number] = [19.076, 72.8777]; // Mumbai
  const radiusKm = 50;

  useEffect(() => {
    // Mock fetching resources
    const fetchResources = async () => {
      try {
        // Since we don't have the actual API endpoint yet, generate mock data
        const mockResources = [
          { id: 1, type: 'BLOOD_BANK', name: 'City Hospital Blood Bank', lat: 19.08, lng: 72.88, details: 'Open 24/7' },
          { id: 2, type: 'DONOR', name: 'John Doe', bg: 'O+', lat: 19.05, lng: 72.89, details: 'Last donated: 3 months ago' },
          { id: 3, type: 'EMERGENCY', name: 'Critical Request', bg: 'A-', lat: 19.1, lng: 72.85, details: 'Needs A- PRBC immediately' },
        ];
        
        setResources(mockResources);
      } catch (err) {
        console.error("Error fetching resources:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResources();
  }, []);

  const filteredResources = resources.filter(r => filter === 'ALL' || r.bg === filter || r.type === 'BLOOD_BANK' || r.type === 'EMERGENCY');

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
        <h2 className="text-xl font-bold text-white">Resource Map</h2>
        <div className="flex gap-4 items-center">
          <span className="text-slate-400 text-sm">Showing {filteredResources.length} resources</span>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-slate-800 text-white border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Blood Groups</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
          </select>
        </div>
      </div>
      
      <div className="w-full h-[calc(100vh-180px)] rounded-lg overflow-hidden border border-slate-800">
        <MapContainer 
          center={center} 
          zoom={11} 
          style={{ height: '100%', width: '100%', background: '#1e293b' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.05, weight: 1 }}
          />

          {filteredResources.map((res) => {
            let icon;
            if (res.type === 'BLOOD_BANK') icon = bloodBankIcon;
            else if (res.type === 'EMERGENCY') icon = emergencyIcon;
            else icon = donorIcon(res.bg || 'O+');

            return (
              <Marker key={res.id} position={[res.lat, res.lng]} icon={icon}>
                <Popup className="custom-popup">
                  <div className="p-2">
                    <h3 className="font-bold text-sm mb-1">{res.name}</h3>
                    <p className="text-xs text-slate-600 mb-2">{res.details}</p>
                    {res.bg && <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-medium">Group: {res.bg}</span>}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
