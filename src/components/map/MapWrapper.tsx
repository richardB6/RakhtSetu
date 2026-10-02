'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const ResourceMap = dynamic(() => import('./ResourceMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-white rounded-lg flex items-center justify-center border border-border shadow-[0_8px_30px_rgba(252,185,181,0.18)]">
      <div className="text-muted-foreground flex flex-col items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapWrapper() {
  const searchParams = useSearchParams();
  return <ResourceMap emergencyId={searchParams.get('emergencyId') || undefined} />;
}
