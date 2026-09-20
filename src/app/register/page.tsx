'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@/types';

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
    bloodGroup: 'O+',
    address: '',
    city: '',
    state: '',
    pincode: '',
    organizationName: '',
    registrationNumber: '',
    licenseNumber: '',
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    const baseProfile = {
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      location: { type: 'Point', coordinates: [72.8777, 19.076] },
    };
    const profile = formData.role === 'DONOR'
      ? { ...baseProfile, bloodGroup: formData.bloodGroup }
      : formData.role === 'HOSPITAL'
        ? {
            ...baseProfile,
            name: formData.organizationName,
            registrationNumber: formData.registrationNumber,
            type: 'PRIVATE',
            contactPerson: formData.name,
            contactPhone: formData.phone,
            contactEmail: formData.email,
          }
        : {
            ...baseProfile,
            name: formData.organizationName,
            licenseNumber: formData.licenseNumber,
            type: 'STANDALONE',
            contactPerson: formData.name,
            contactPhone: formData.phone,
            contactEmail: formData.email,
            operatingHours: '24/7',
          };

    const result = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: formData.role,
      profile,
    });
    
    if (result.success) {
      router.push('/command-center');
    } else {
      setError(result.message || 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Join RakthSetu</h1>
            <p className="text-slate-400 text-sm">Create an account to save lives</p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="you@example.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input
                type="tel"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
              >
                <option value="DONOR">Donor (Donate Blood)</option>
                <option value="HOSPITAL">Hospital (Request Blood)</option>
                <option value="BLOOD_BANK">Blood Bank (Manage Supply)</option>
              </select>
            </div>

            {formData.role === 'DONOR' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Blood Group</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                  value={formData.bloodGroup}
                  onChange={e => setFormData({ ...formData, bloodGroup: e.target.value })}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {formData.role === 'HOSPITAL' ? 'Hospital Name' : 'Blood Bank Name'}
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    value={formData.organizationName}
                    onChange={e => setFormData({ ...formData, organizationName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {formData.role === 'HOSPITAL' ? 'Registration Number' : 'License Number'}
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    value={formData.role === 'HOSPITAL' ? formData.registrationNumber : formData.licenseNumber}
                    onChange={e => setFormData({
                      ...formData,
                      ...(formData.role === 'HOSPITAL'
                        ? { registrationNumber: e.target.value }
                        : { licenseNumber: e.target.value }),
                    })}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <input aria-label="Address" required placeholder="Address" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              <input aria-label="City" required placeholder="City" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              <input aria-label="State" required placeholder="State" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
              <input aria-label="Pincode" required placeholder="Pincode" className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors mt-6 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-red-500 hover:text-red-400 font-medium">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
