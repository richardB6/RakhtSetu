'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils/date';
import { User, Mail, Phone, Shield, Calendar, Edit2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  if (!user) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-muted-foreground">Please log in to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl text-foreground">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <button className="secondary-action flex items-center gap-2 px-4 py-2 bg-white hover:bg-accent text-primary border border-border rounded-lg text-sm font-medium">
          <Edit2 className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="ops-panel overflow-hidden rounded-md">
        <div className="h-32 bg-gradient-to-r from-accent to-secondary relative">
        <div className="floating-avatar absolute -bottom-12 left-8 w-24 h-24 bg-white border-4 border-white rounded-full flex items-center justify-center text-4xl">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-muted-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        
        <div className="pt-16 pb-8 px-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">{user.name}</h2>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent text-accent-foreground border border-border">
                  {user.role}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                  user.verificationStatus === 'VERIFIED' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {user.verificationStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Contact Information</h3>
              
              <div className="flex items-center gap-3 text-foreground">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              
              <div className="flex items-center gap-3 text-foreground">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <span>{user.phone}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Account Details</h3>
              
              <div className="flex items-center gap-3 text-foreground">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span>Status: {user.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              
              <div className="flex items-center gap-3 text-foreground">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span>Member since {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
