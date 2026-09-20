import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to access this resource. Contact your system administrator if you believe this is an error.
        </p>
        <Link
          href="/command-center"
          className="inline-block mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Return to Command Center
        </Link>
      </div>
    </div>
  );
}
