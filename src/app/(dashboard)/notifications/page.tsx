'use client';

import { useState, useEffect } from 'react';
import { timeAgo } from '@/lib/utils/date';
import { Bell, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { NotificationSeverity, NotificationType } from '@/types';

interface NotificationMock {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationMock[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    const response = await fetch('/api/notifications?limit=50');
    const result = await response.json();
    setNotifications(response.ok && result.success ? result.data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'CRITICAL') return n.severity === 'CRITICAL';
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getSeverityStyles = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-red-500 bg-red-500/10';
      case 'HIGH': return 'border-l-amber-500 bg-amber-500/10';
      case 'NORMAL': return 'border-l-blue-400 bg-card';
      case 'INFO': return 'border-l-slate-500 bg-card';
      default: return 'border-l-slate-500 bg-card';
    }
  };

  const getIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'HIGH': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'NORMAL': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'INFO': return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Notification Center</h1>
          {unreadCount > 0 && (
            <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-bold text-destructive">
              {unreadCount} new
            </span>
          )}
        </div>
        <button 
          onClick={markAllRead}
          className="focus-control text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Mark all as read
        </button>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'CRITICAL', 'UNREAD'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f 
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'bg-muted text-muted-foreground border border-border hover:bg-accent'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="ops-panel p-8 text-center text-muted-foreground">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="ops-panel p-12 text-center">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications found.</p>
          </div>
        ) : (
          filtered.map(notif => (
            <div 
              key={notif._id}
              onClick={() => !notif.isRead && markRead(notif._id)}
              className={`cursor-pointer rounded-md border-y border-r border-l-4 p-4 transition-all ${getSeverityStyles(notif.severity)} ${!notif.isRead ? 'opacity-100 shadow-md shadow-black/20' : 'opacity-70'}`}
            >
              <div className="flex gap-4">
                <div className="mt-1">{getIcon(notif.severity)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm ${notif.isRead ? 'font-medium text-muted-foreground' : 'font-bold text-foreground'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-muted-foreground">{timeAgo(notif.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {filtered.length > 0 && (
        <div className="mt-8 flex justify-center">
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 hover:text-white disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 hover:text-white">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
