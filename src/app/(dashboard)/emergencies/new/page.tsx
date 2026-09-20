'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BLOOD_GROUPS, COMPONENT_TYPES, COMPONENT_LABELS, SEVERITY_LEVELS, SEVERITY_CONFIG, ComponentType } from '@/lib/engine/compatibility';

export default function NewEmergencyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    patientReference: '',
    patientAge: '',
    patientGender: '',
    bloodGroup: '',
    component: '',
    quantity: 1,
    severity: 'HIGH',
    requiredBy: '',
    contactPerson: '',
    contactPhone: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: typeof value === 'string' ? value : '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/emergencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          patientAge: formData.patientAge ? parseInt(formData.patientAge) : undefined,
          quantity: parseInt(formData.quantity.toString())
        })
      });

      const data = await res.json();
      if (data.success) {
        // Success Toast could be added here
        router.push(`/emergencies/${data.data._id}`);
      } else {
        setError(data.message || 'Failed to create emergency request.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSeverity = SEVERITY_CONFIG[formData.severity as keyof typeof SEVERITY_CONFIG];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Emergency Request</h1>
        <p className="text-slate-500 mt-2">Initialize a coordinated search for compatible blood components.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Clinical Requirements
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patientReference">Patient Reference *</Label>
                  <Input id="patientReference" name="patientReference" required value={formData.patientReference} onChange={handleChange} placeholder="e.g., Ward 4 - Bed 12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientAge">Patient Age</Label>
                  <Input type="number" id="patientAge" name="patientAge" value={formData.patientAge} onChange={handleChange} placeholder="Years" min="0" max="150" />
                </div>
                <div className="space-y-2">
                  <Label>Patient Gender</Label>
                  <Select onValueChange={(val) => handleSelectChange('patientGender', val)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Blood Group *</Label>
                  <Select required onValueChange={(val) => handleSelectChange('bloodGroup', val)}>
                    <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Component Type *</Label>
                  <Select required onValueChange={(val) => handleSelectChange('component', val)}>
                    <SelectTrigger><SelectValue placeholder="Select Component" /></SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map(comp => (
                        <SelectItem key={comp} value={comp}>{COMPONENT_LABELS[comp as ComponentType]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity (Units) *</Label>
                  <Input type="number" id="quantity" name="quantity" required min="1" max="50" value={formData.quantity} onChange={handleChange} />
                </div>
              </div>

              <div className="border-t pt-6">
                <Label className="mb-4 block">Severity Level *</Label>
                <div className="grid grid-cols-3 gap-4">
                  {SEVERITY_LEVELS.map(level => {
                    const isSelected = formData.severity === level;
                    const config = SEVERITY_CONFIG[level];
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleSelectChange('severity', level)}
                        className={`p-4 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${
                          isSelected 
                            ? `border-${config.color}-500 bg-${config.color}-50 ring-2 ring-${config.color}-500/20` 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {level === 'CRITICAL' && <ShieldAlert className={`w-6 h-6 text-red-500 ${isSelected ? 'animate-pulse' : ''}`} />}
                        <span className="font-semibold">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requiredBy">Required By *</Label>
                  <Input type="datetime-local" id="requiredBy" name="requiredBy" required value={formData.requiredBy} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <Input id="contactPerson" name="contactPerson" required value={formData.contactPerson} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone *</Label>
                  <Input id="contactPhone" name="contactPhone" required value={formData.contactPhone} onChange={handleChange} />
                </div>
              </div>

              <div className="border-t pt-6 space-y-2">
                <Label htmlFor="notes">Clinical Notes (Optional)</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Any specific requirements or clinical context..." rows={3} />
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                {loading ? 'Initializing...' : 'Initialize Request'}
              </Button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border rounded-xl shadow-sm p-6 sticky top-8">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Request Summary</h3>
            
            <div className="space-y-6">
              <div>
                <div className="text-sm text-slate-500 mb-1">Requirement</div>
                <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  {formData.quantity}x {formData.bloodGroup || '??'}
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {formData.component ? COMPONENT_LABELS[formData.component as ComponentType] : 'Select Component'}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-slate-500 mb-1">Severity & Timeline</div>
                <div className="flex items-center gap-2 mb-2">
                  {selectedSeverity && (
                    <span className={`inline-flex w-3 h-3 rounded-full bg-${selectedSeverity.color}-500 ${formData.severity === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                  )}
                  <span className="font-semibold">{selectedSeverity?.label || 'Select'}</span>
                </div>
                {formData.requiredBy && (
                  <div className="text-sm text-slate-600">
                    By: {new Date(formData.requiredBy).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-slate-500 mb-1">Patient Details</div>
                <div className="font-medium">{formData.patientReference || 'Pending reference'}</div>
                <div className="text-sm text-slate-600">
                  {[formData.patientAge ? `${formData.patientAge}y` : null, formData.patientGender].filter(Boolean).join(' • ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
