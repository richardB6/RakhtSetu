'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const ResourceMap = dynamic(() => import('./ResourceMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
      <div className="text-slate-400 flex flex-col items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-4"></div>
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapWrapper() {
  const searchParams = useSearchParams();
  return <ResourceMap emergencyId={searchParams.get('emergencyId') || undefined} />;
}
