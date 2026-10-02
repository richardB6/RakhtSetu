'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, MapPin } from 'lucide-react';
import { UserRole } from '@/types';
import { getCityCoordinates, getBrowserLocation } from '@/lib/utils/geocode';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'DONOR' as UserRole,
    // Donor fields
    bloodGroup: 'O+',
    dateOfBirth: '',
    gender: '',
    availabilityStatus: 'AVAILABLE',
    lastDonationDate: '',
    // Address (all roles)
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Org fields
    organizationName: '',
    registrationNumber: '',
    licenseNumber: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'detecting' | 'detected' | 'fallback'>('idle');
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const update = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    // Determine location from browser geo or city/state fallback — never hardcode Mumbai
    let coords: { lat: number; lng: number };
    try {
      setGeoStatus('detecting');
      const browserCoords = await getBrowserLocation();
      if (browserCoords) {
        coords = browserCoords;
        setDetectedCoords(browserCoords);
        setGeoStatus('detected');
      } else {
        const cityCoords = getCityCoordinates(formData.city, formData.state);
        coords = cityCoords;
        setGeoStatus('fallback');
      }
    } catch {
      const cityCoords = getCityCoordinates(formData.city, formData.state);
      coords = cityCoords;
      setGeoStatus('fallback');
    }

    const baseProfile = {
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
    };

    let profile: Record<string, unknown>;
    if (formData.role === 'DONOR') {
      profile = {
        ...baseProfile,
        bloodGroup: formData.bloodGroup,
        ...(formData.dateOfBirth ? { dateOfBirth: formData.dateOfBirth } : {}),
        ...(formData.gender ? { gender: formData.gender } : {}),
        ...(formData.lastDonationDate ? { lastDonationDate: formData.lastDonationDate } : {}),
        availabilityStatus: formData.availabilityStatus || 'AVAILABLE',
        emergencyNotificationsEnabled: true,
      };
    } else if (formData.role === 'HOSPITAL') {
      profile = {
        ...baseProfile,
        name: formData.organizationName,
        registrationNumber: formData.registrationNumber,
        type: 'PRIVATE',
        contactPerson: formData.name,
        contactPhone: formData.phone,
        contactEmail: formData.email,
        operatingHours: '24/7',
      };
    } else {
      profile = {
        ...baseProfile,
        name: formData.organizationName,
        licenseNumber: formData.licenseNumber,
        type: 'STANDALONE',
        contactPerson: formData.name,
        contactPhone: formData.phone,
        contactEmail: formData.email,
        operatingHours: '24/7',
        componentCapabilities: ['WHOLE_BLOOD', 'PRBC', 'PLATELETS_RDP', 'FFP'],
      };
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: formData.role,
      profile,
    });

    if (result.success) {
      // Role-appropriate redirect
      if (formData.role === 'DONOR') {
        router.push('/donor');
      } else {
        router.push('/command-center');
      }
    } else {
      setError(result.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Image
            src="/rakthsetu-logo.png"
            alt="RakthSetu"
            width={128}
            height={128}
            priority
            className="mx-auto mb-4 h-28 w-28 rounded-3xl object-cover shadow-[0_8px_24px_rgba(252,185,181,0.24)]"
          />
          <h1 className="text-2xl font-bold tracking-tight">RAKTHSETU</h1>
          <p className="text-sm text-muted-foreground">
            Emergency Blood Coordination Network
          </p>
        </div>

        {/* Form Card */}
        <div className="surface-card p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Create Account</h2>
            <p className="text-xs text-muted-foreground">
              Join the network and help save lives
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-foreground">Full Name *</label>
                <input
                  type="text"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Phone *</label>
                <input
                  type="tel"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Account Type *</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.role}
                onChange={(e) => update('role', e.target.value)}
              >
                <option value="DONOR">Donor — Donate Blood</option>
                <option value="HOSPITAL">Hospital — Request Blood</option>
                <option value="BLOOD_BANK">Blood Bank — Manage Supply</option>
              </select>
            </div>

            {/* Role-specific fields */}
            {formData.role === 'DONOR' ? (
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Donor Information
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Blood Group *</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={formData.bloodGroup}
                      onChange={(e) => update('bloodGroup', e.target.value)}
                    >
                      {BLOOD_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Gender</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={formData.gender}
                      onChange={(e) => update('gender', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={formData.dateOfBirth}
                      onChange={(e) => update('dateOfBirth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Availability</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.availabilityStatus}
                    onChange={(e) => update('availabilityStatus', e.target.value)}
                  >
                    <option value="AVAILABLE">Available for donation</option>
                    <option value="TEMPORARILY_UNAVAILABLE">Temporarily unavailable</option>
                    <option value="UNAVAILABLE">Not available</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Last Donation Date <span className="text-muted-foreground">(optional)</span></label>
                  <input
                    type="date"
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.lastDonationDate || ''}
                    onChange={(e) => update('lastDonationDate', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-[11px] text-muted-foreground">Donors must wait at least 56 days between donations. Leave blank if never donated.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formData.role === 'HOSPITAL' ? 'Hospital' : 'Blood Bank'} Information
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    {formData.role === 'HOSPITAL' ? 'Hospital Name' : 'Blood Bank Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.organizationName}
                    onChange={(e) => update('organizationName', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    {formData.role === 'HOSPITAL' ? 'Registration Number' : 'License Number'} *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={
                      formData.role === 'HOSPITAL'
                        ? formData.registrationNumber
                        : formData.licenseNumber
                    }
                    onChange={(e) =>
                      update(
                        formData.role === 'HOSPITAL' ? 'registrationNumber' : 'licenseNumber',
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {geoStatus === 'detected'
                  ? <span className="text-emerald-600">📍 Precise location detected via GPS</span>
                  : geoStatus === 'fallback'
                  ? <span className="text-amber-600">📍 Location will be estimated from city/state</span>
                  : <span>Your location will be detected from city/state (or browser GPS if permitted)</span>
                }
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-foreground">Address *</label>
                <input
                  type="text"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={(e) => update('address', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">City *</label>
                <input
                  type="text"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Mumbai"
                  value={formData.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">State *</label>
                <input
                  type="text"
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Maharashtra"
                  value={formData.state}
                  onChange={(e) => update('state', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Pincode *</label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{6}"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="400001"
                  value={formData.pincode}
                  onChange={(e) => update('pincode', e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.password}
                    onChange={(e) => update('password', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Confirm Password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={formData.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                />
              </div>
            </div>

            {/* Consent note for donors */}
            {formData.role === 'DONOR' && (
              <p className="text-[11px] text-muted-foreground">
                By registering, you consent to being contacted for compatible blood donation
                requests. Your contact details are only shared with verified hospitals and
                blood banks under emergency conditions.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
