'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Bell, Shield, Palette, Database, Globe } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { user } = useAuth();

  const sections = [
    {
      icon: Bell,
      title: 'Notification Preferences',
      description: 'Configure how you receive emergency alerts and system notifications',
      items: [
        { label: 'Emergency alerts', value: 'Enabled', active: true },
        { label: 'Match notifications', value: 'Enabled', active: true },
        { label: 'System updates', value: 'Enabled', active: true },
        { label: 'Email notifications', value: 'Not configured', active: false },
      ],
    },
    {
      icon: Shield,
      title: 'Security',
      description: 'Manage password and session settings',
      items: [
        { label: 'Two-factor authentication', value: 'Not enabled', active: false },
        { label: 'Session timeout', value: '15 minutes', active: true },
        { label: 'Last password change', value: 'Never', active: false },
      ],
    },
    {
      icon: Globe,
      title: 'Platform',
      description: 'System configuration and preferences',
      items: [
        { label: 'Demo mode', value: process.env.NEXT_PUBLIC_APP_NAME || 'Active', active: true },
        { label: 'Data refresh interval', value: '10 seconds', active: true },
        { label: 'Map tile provider', value: 'CartoDB Positron', active: true },
        { label: 'Default search radius', value: '25 km', active: true },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration and preferences
        </p>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Card key={section.title} className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{section.title}</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-7">{section.description}</p>
            <div className="space-y-0 ml-7">
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <Badge variant={item.active ? 'secondary' : 'outline'} className="text-xs">
                      {item.value}
                    </Badge>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
